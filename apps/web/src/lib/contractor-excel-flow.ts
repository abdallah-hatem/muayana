import {
  BULK_IDS_MAX,
  ISSUE_STATUSES,
  canMove,
  exportColumnDef,
  isClosed,
  issueHistoryFacts,
  todayInCairo,
  type BulkIssuesResponse,
  type HistoryFacts,
  type Issue,
  type IssueExportColumn,
  type IssueStatus,
  type Locale,
  type PhotoKind,
} from '@muayana/shared';
import { chunk } from './all-pages';
import type { ApiFailure, ApiResult } from './api-result';
import {
  EXCEL_MAX_BYTES,
  buildContractorWorkbook,
  issuesThatFit,
  workbookBytes,
  type ExcelRow,
  type Thumbnail,
} from './contractor-excel';
import { listWorkerIssues } from './directory-endpoints';
import { bulkIssues, getIssue } from './issue-endpoints';
import { toIssueState } from './issue-state';
import { fetchThumbnail } from './thumbnail';

/*
 * "Send as Excel" from a contractor's page (business §5.5): read every one of his issues in the
 * chosen statuses, build the .xlsx on the phone, and afterwards mark the `assigned` ones sent.
 */

/** Parallel requests while photos and histories are read. */
const CONCURRENCY = 4;

/** `fn` over `items`, at most `limit` at a time, results in order. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

/**
 * Every issue of the contractor in `statuses` — all pages of each (invariant §6.14) — in workflow
 * order, newest first within a status. Any failed read fails the whole list.
 */
export async function contractorIssues(
  workerId: string,
  statuses: readonly IssueStatus[],
): Promise<ApiResult<Issue[]>> {
  const ordered = ISSUE_STATUSES.filter((s) => statuses.includes(s));
  const results = await Promise.all(
    ordered.map((status) => listWorkerIssues(workerId, status)),
  );
  const failed = results.find((r) => !r.success);
  if (failed) return failed;
  return {
    success: true,
    status: 200,
    data: results.flatMap((r) => (r.success ? r.data : [])),
  };
}

/** Whose history the columns need: the last note reads every issue's, days open a closed one's. */
const needsHistory = (
  issue: Issue,
  columns: readonly IssueExportColumn[],
): boolean =>
  columns.includes('lastNote') ||
  (columns.includes('daysOpen') && isClosed(issue.status));

/** The photo kinds the chosen columns show as pictures. */
export const pictureKinds = (
  columns: readonly IssueExportColumn[],
): PhotoKind[] =>
  columns.flatMap((c) => {
    const kind = exportColumnDef(c).photoKind;
    return kind ? [kind] : [];
  });

export type Progress = { done: number; total: number };

/** The issues as Excel rows: history facts where needed, and their photos as thumbnails. */
export async function excelRows(
  issues: readonly Issue[],
  columns: readonly IssueExportColumn[],
  onProgress: (p: Progress) => void = () => undefined,
): Promise<ApiResult<ExcelRow[]>> {
  const kinds = pictureKinds(columns);
  const photos = issues.flatMap((issue) =>
    issue.photos.filter((p) => kinds.includes(p.kind)),
  );
  const total = photos.length;
  let done = 0;
  onProgress({ done, total });

  // Set from inside the callbacks (an object, so TypeScript doesn't narrow it to null).
  const read: { failure: ApiFailure | null } = { failure: null };
  const facts = await mapLimited(
    issues,
    CONCURRENCY,
    async (issue): Promise<HistoryFacts | undefined> => {
      if (read.failure || !needsHistory(issue, columns)) return undefined;
      const res = await getIssue(issue.id);
      if (!res.success) {
        read.failure = res;
        return undefined;
      }
      return issueHistoryFacts([...res.data.history].reverse(), issue.status);
    },
  );
  if (read.failure) return read.failure;

  const thumbs = new Map<string, Thumbnail | null>();
  await mapLimited(photos, CONCURRENCY, async (photo) => {
    thumbs.set(photo.id, await fetchThumbnail(photo.url));
    done += 1;
    onProgress({ done, total });
  });

  return {
    success: true,
    status: 200,
    data: issues.map((issue, i) => ({
      issue,
      facts: facts[i],
      pictures: Object.fromEntries(
        kinds.map((kind) => [
          kind,
          issue.photos
            .filter((p) => p.kind === kind)
            .map((p) => thumbs.get(p.id) ?? null),
        ]),
      ),
    })),
  };
}

/** The file to share, or how many issues would fit when it came out too big. */
export type BuiltExcel =
  | { kind: 'file'; file: File; issues: Issue[] }
  | { kind: 'tooBig'; size: number; fit: number; total: number };

/** A file name from the contractor's name and today's Cairo date. */
export const excelFileName = (workerName: string, now: Date): string =>
  `${workerName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'worker'}-${todayInCairo(now)}.xlsx`;

export const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Writes the .xlsx for `rows`; over `maxBytes` it answers how many leading issues would fit. */
export async function writeExcel({
  rows,
  columns,
  lang,
  now,
  workerName,
  maxBytes = EXCEL_MAX_BYTES,
}: {
  rows: readonly ExcelRow[];
  columns: readonly IssueExportColumn[];
  lang: Locale;
  now: Date;
  workerName: string;
  maxBytes?: number;
}): Promise<BuiltExcel> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = buildContractorWorkbook(ExcelJS, {
    rows,
    columns,
    lang,
    now,
    sheetName: workerName,
  });
  const bytes = await workbookBytes(workbook);
  if (bytes.byteLength > maxBytes)
    return {
      kind: 'tooBig',
      size: bytes.byteLength,
      fit: issuesThatFit(rows, bytes.byteLength, maxBytes),
      total: rows.length,
    };
  return {
    kind: 'file',
    file: new File([bytes as BlobPart], excelFileName(workerName, now), {
      type: XLSX_TYPE,
    }),
    issues: rows.map((r) => r.issue as Issue),
  };
}

/** The issues of a file that "Mark as sent?" moves: its `assigned` ones only (§5.5). */
export const markableIssues = (issues: readonly Issue[]): Issue[] =>
  issues.filter((i) => i.status === 'assigned');

/** The issue numbers the rules refuse to mark sent (checked before any request). */
export const refusedNumbers = (issues: readonly Issue[]): number[] =>
  issues
    .filter((i) => !canMove(toIssueState(i), 'sent').ok)
    .map((i) => i.number);

/**
 * Marks the file's `assigned` issues sent with bulk requests of at most BULK_IDS_MAX ids (§5.5).
 * Each request is all-or-nothing on the server (§5.3); the first refusal stops the rest.
 */
export async function markExcelIssuesSent(
  issues: readonly Issue[],
): Promise<ApiResult<{ updated: number }>> {
  let updated = 0;
  for (const ids of chunk(
    markableIssues(issues).map((i) => i.id),
    BULK_IDS_MAX,
  )) {
    const res: ApiResult<BulkIssuesResponse> = await bulkIssues({
      ids,
      status: 'sent',
    });
    if (!res.success) return { ...res, data: { updated } };
    updated += res.data.updated;
  }
  return { success: true, status: 200, data: { updated } };
}
