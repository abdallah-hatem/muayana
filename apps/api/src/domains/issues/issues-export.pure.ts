import {
  STATUS_LABELS,
  formatCairoDateTime,
  issueExportCells,
  issueHistoryFacts,
  type CsvValue,
  type ExportIssue,
  type HistoryFacts,
  type IssueExportColumn,
  type Locale,
} from '@muayana/shared';
import { dbToDateOnly } from '../../common/utils/issue-filter.util';
import type {
  HistoryExportRow,
  IssueChangeRow,
  IssueRow,
} from './repositories/issue.repository';

/*
 * The issues and status-history CSVs (business §7), as pure mapping: rows in, cells out. The
 * columns — headers and values — are the one shared list (@muayana/shared issue-export), the same
 * one the contractor Excel uses. The service streams them; the shared csvRow guards formulas.
 */

/**
 * Per issue: the newest note, and when it last moved to its current status (only the newest move
 * counts). `changes` come newest first, as IssueRepository.findChangesOf returns them.
 */
export function historyFacts(
  changes: readonly IssueChangeRow[],
  currentStatus: ReadonlyMap<string, IssueRow['status']>,
): Map<string, HistoryFacts> {
  const byIssue = new Map<string, IssueChangeRow[]>();
  for (const change of changes) {
    const list = byIssue.get(change.issueId) ?? [];
    list.push(change);
    byIssue.set(change.issueId, list);
  }
  const facts = new Map<string, HistoryFacts>();
  for (const [issueId, list] of byIssue) {
    facts.set(issueId, issueHistoryFacts(list, currentStatus.get(issueId)));
  }
  return facts;
}

/** A database row as the shared export reads an issue (the estimated date as `YYYY-MM-DD`). */
export const toExportIssue = (row: IssueRow): ExportIssue => ({
  ...row,
  estimatedDate: dbToDateOnly(row.estimatedDate),
});

/** One issue as CSV cells, in `columns` order. */
export const issueCells = (
  row: IssueRow,
  facts: HistoryFacts | undefined,
  columns: readonly IssueExportColumn[],
  lang: Locale,
  now: Date,
): CsvValue[] =>
  issueExportCells(toExportIssue(row), columns, { lang, now, facts });

export const HISTORY_HEADERS: Record<Locale, readonly string[]> = {
  ar: ['الموقع', 'الرقم', 'من', 'إلى', 'التاريخ', 'ملاحظة'],
  en: ['Site', 'Number', 'From', 'To', 'Date', 'Note'],
};

/** One status change as CSV cells (the first change has no `from`). */
export const historyCells = (
  row: HistoryExportRow,
  lang: Locale,
): CsvValue[] => [
  row.issue.site.name,
  row.issue.number,
  row.from && STATUS_LABELS[lang][row.from],
  STATUS_LABELS[lang][row.to],
  formatCairoDateTime(row.createdAt),
  row.note,
];
