import {
  ISSUE_EXPORT_COLUMNS,
  cairoDaysBetween,
  formatCairoDateTime,
  isClosed,
  isOverdue,
  type CsvValue,
  type IssueExportColumn,
  type Locale,
  type PhotoKind,
} from '@muayana/shared';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  categoryName,
  yesNo,
} from '../../common/utils/csv.util';
import { dbToDateOnly } from '../../common/utils/issue-filter.util';
import type {
  HistoryExportRow,
  IssueChangeRow,
  IssueRow,
} from './repositories/issue.repository';

/*
 * The issues and status-history CSVs (business §7), as pure mapping: rows in, cells out. The
 * service streams them; the shared csvRow guards formulas.
 */

/** Column headers in each language, the same wording as the web's export dialog. */
export const ISSUE_COLUMN_HEADERS: Record<
  Locale,
  Record<IssueExportColumn, string>
> = {
  ar: {
    number: 'الرقم',
    site: 'الموقع',
    status: 'الحالة',
    category: 'التصنيف',
    worker: 'العامل',
    workerPhone: 'هاتف العامل',
    priority: 'الأولوية',
    description: 'الوصف',
    location: 'المكان',
    capturedAt: 'تاريخ التصوير',
    assignedAt: 'تاريخ الإسناد',
    sentAt: 'تاريخ الإرسال',
    estimatedDate: 'الموعد المتوقع',
    solvedAt: 'تاريخ الحل',
    overdue: 'متأخر',
    daysOpen: 'أيام مفتوحة',
    photoLinks: 'روابط الصور',
    afterPhotoLinks: 'روابط صور بعد الإصلاح',
    lastNote: 'آخر ملاحظة',
  },
  en: {
    number: 'Number',
    site: 'Site',
    status: 'Status',
    category: 'Category',
    worker: 'Worker',
    workerPhone: 'Worker phone',
    priority: 'Priority',
    description: 'Description',
    location: 'Location',
    capturedAt: 'Captured at',
    assignedAt: 'Assigned at',
    sentAt: 'Sent at',
    estimatedDate: 'Estimated date',
    solvedAt: 'Solved at',
    overdue: 'Overdue',
    daysOpen: 'Days open',
    photoLinks: 'Photo links',
    afterPhotoLinks: 'After-photo links',
    lastNote: 'Last note',
  },
};

/** The columns to write: as requested and in that order, or all of §7 in its order. */
export const exportColumns = (
  requested: readonly IssueExportColumn[] | undefined,
): readonly IssueExportColumn[] => requested ?? ISSUE_EXPORT_COLUMNS;

/** What an issue's history adds to its CSV row. */
export interface HistoryFacts {
  /** The newest note written on a status change. */
  lastNote: string | null;
  /** When the issue last moved into its current status (a closed issue's closing time). */
  enteredStatusAt: Date | null;
}

/**
 * Per issue: the newest note, and when it last moved to each status (only the newest move
 * counts). `changes` come newest first, as IssueRepository.findChangesOf returns them.
 */
export function historyFacts(
  changes: readonly IssueChangeRow[],
  currentStatus: ReadonlyMap<string, IssueRow['status']>,
): Map<string, HistoryFacts> {
  const facts = new Map<string, HistoryFacts>();
  for (const change of changes) {
    const fact = facts.get(change.issueId) ?? {
      lastNote: null,
      enteredStatusAt: null,
    };
    if (fact.lastNote === null && change.note) fact.lastNote = change.note;
    if (
      fact.enteredStatusAt === null &&
      change.to === currentStatus.get(change.issueId)
    )
      fact.enteredStatusAt = change.createdAt;
    facts.set(change.issueId, fact);
  }
  return facts;
}

/**
 * Days open (§7): Cairo days from capture until the issue was closed (solved or cancelled), or
 * until now while it is still open.
 */
export function daysOpen(
  row: Pick<IssueRow, 'status' | 'capturedAt' | 'solvedAt' | 'updatedAt'>,
  enteredStatusAt: Date | null,
  now: Date,
): number {
  const end = isClosed(row.status)
    ? (enteredStatusAt ?? row.solvedAt ?? row.updatedAt)
    : now;
  return cairoDaysBetween(row.capturedAt, end);
}

const photoLinks = (row: IssueRow, kind: PhotoKind): string =>
  row.photos
    .filter((p) => p.kind === kind)
    .map((p) => p.url)
    .join('\n');

/** One issue as CSV cells, in `columns` order. */
export function issueCells(
  row: IssueRow,
  facts: HistoryFacts | undefined,
  columns: readonly IssueExportColumn[],
  lang: Locale,
  now: Date,
): CsvValue[] {
  const estimatedDate = dbToDateOnly(row.estimatedDate);
  const cell = (column: IssueExportColumn): CsvValue => {
    switch (column) {
      case 'number':
        return row.number;
      case 'site':
        return row.site.name;
      case 'status':
        return STATUS_LABELS[lang][row.status];
      case 'category':
        return row.category && categoryName(row.category, lang);
      case 'worker':
        return row.worker?.name;
      case 'workerPhone':
        return row.worker?.phone;
      case 'priority':
        return PRIORITY_LABELS[lang][row.priority];
      case 'description':
        return row.description;
      case 'location':
        return row.location;
      case 'capturedAt':
        return formatCairoDateTime(row.capturedAt);
      case 'assignedAt':
        return formatCairoDateTime(row.assignedAt);
      case 'sentAt':
        return formatCairoDateTime(row.sentAt);
      case 'estimatedDate':
        return estimatedDate;
      case 'solvedAt':
        return formatCairoDateTime(row.solvedAt);
      case 'overdue':
        return yesNo(
          isOverdue({ status: row.status, estimatedDate }, now),
          lang,
        );
      case 'daysOpen':
        return daysOpen(row, facts?.enteredStatusAt ?? null, now);
      case 'photoLinks':
        return photoLinks(row, 'before');
      case 'afterPhotoLinks':
        return photoLinks(row, 'after');
      case 'lastNote':
        return facts?.lastNote;
    }
  };
  return columns.map(cell);
}

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
