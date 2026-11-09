import type {
  IssueStatus,
  Locale,
  PhotoKind,
  Priority,
} from '../schemas/enums';
import {
  ISSUE_EXPORT_COLUMNS,
  type IssueExportColumn,
} from '../schemas/exports';
import type { CsvValue } from './csv';
import { cairoDaysBetween, formatCairoDateTime, isOverdue } from './dates';
import { isClosed } from './status';

/*
 * The issue export columns (business §7) — ONE list for the issues CSV (API) and the contractor
 * Excel (web): each column's key, its header in both languages, and how its value is read from an
 * issue. Status/priority/yes-no wording is the export's own (the file is read outside the app).
 */

export const YES_NO: Record<Locale, readonly [yes: string, no: string]> = {
  ar: ['نعم', 'لا'],
  en: ['Yes', 'No'],
};

export const yesNo = (value: boolean, lang: Locale): string =>
  YES_NO[lang][value ? 0 : 1];

/** Status names as the app shows them (business §4 table). */
export const STATUS_LABELS: Record<Locale, Record<IssueStatus, string>> = {
  ar: {
    new: 'جديد',
    unassigned: 'غير مُسند',
    assigned: 'مُسند',
    sent: 'أُرسل للمقاول',
    estimated: 'تم تحديد موعد',
    in_progress: 'جاري العمل',
    solved: 'تم الحل',
    cancelled: 'ملغي',
  },
  en: {
    new: 'New',
    unassigned: 'Unassigned',
    assigned: 'Assigned',
    sent: 'Sent',
    estimated: 'Estimated',
    in_progress: 'In progress',
    solved: 'Solved',
    cancelled: 'Cancelled',
  },
};

export const PRIORITY_LABELS: Record<Locale, Record<Priority, string>> = {
  ar: { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' },
  en: { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
};

/** A category's name in an export's language (English falls back to Arabic). */
export const exportCategoryName = (
  category: { nameAr: string; nameEn: string | null },
  lang: Locale,
): string =>
  lang === 'en' ? (category.nameEn ?? category.nameAr) : category.nameAr;

type Instant = Date | string;

/** What an export reads from an issue: the API's database row and the web's `Issue` both fit. */
export interface ExportIssue {
  number: number;
  site: { name: string };
  status: IssueStatus;
  priority: Priority;
  description: string | null;
  location: string | null;
  category: { nameAr: string; nameEn: string | null } | null;
  worker: { name: string; phone: string } | null;
  /** `YYYY-MM-DD` */
  estimatedDate: string | null;
  capturedAt: Instant;
  updatedAt: Instant;
  assignedAt: Instant | null;
  sentAt: Instant | null;
  solvedAt: Instant | null;
  /** In display order (`before` first, then by sort order). */
  photos: readonly { kind: PhotoKind; url: string }[];
}

/** What an issue's history adds to its export row. */
export interface HistoryFacts {
  /** The newest note written on a status change. */
  lastNote: string | null;
  /** When the issue last moved into its current status (a closed issue's closing time). */
  enteredStatusAt: Instant | null;
}

/**
 * One issue's history facts from its changes, **newest first**: the newest note, and when it last
 * moved into `status` (only the newest such move counts).
 */
export function issueHistoryFacts(
  changesNewestFirst: readonly {
    to: IssueStatus;
    note: string | null;
    createdAt: Instant;
  }[],
  /** The issue's current status (unknown → no entry time). */
  status: IssueStatus | undefined,
): HistoryFacts {
  const facts: HistoryFacts = { lastNote: null, enteredStatusAt: null };
  for (const change of changesNewestFirst) {
    if (facts.lastNote === null && change.note) facts.lastNote = change.note;
    if (facts.enteredStatusAt === null && change.to === status)
      facts.enteredStatusAt = change.createdAt;
  }
  return facts;
}

const toDate = (instant: Instant): Date =>
  instant instanceof Date ? instant : new Date(instant);

/**
 * Days open (§7): Cairo days from capture until the issue was closed (solved or cancelled), or
 * until now while it is still open.
 */
export function daysOpen(
  issue: Pick<ExportIssue, 'status' | 'capturedAt' | 'solvedAt' | 'updatedAt'>,
  enteredStatusAt: Instant | null,
  now: Date,
): number {
  const end = isClosed(issue.status)
    ? (enteredStatusAt ?? issue.solvedAt ?? issue.updatedAt)
    : now;
  return cairoDaysBetween(toDate(issue.capturedAt), toDate(end));
}

/** The photo URLs of one kind, one per line, in display order. */
const photoLinks = (issue: ExportIssue, kind: PhotoKind): string =>
  issue.photos
    .filter((p) => p.kind === kind)
    .map((p) => p.url)
    .join('\n');

/** Everything a column's value may read besides the issue. */
export interface ExportContext {
  lang: Locale;
  now: Date;
  facts?: HistoryFacts;
}

export interface IssueExportColumnDef {
  key: IssueExportColumn;
  /** The header, in the export's language. */
  label: Record<Locale, string>;
  /**
   * Set on the photo-link columns: in the contractor Excel the column holds these photos as
   * pictures (never URLs), under `pictureLabel`.
   */
  photoKind?: PhotoKind;
  pictureLabel?: Record<Locale, string>;
  value: (issue: ExportIssue, ctx: ExportContext) => CsvValue;
}

const dateTime =
  (pick: (i: ExportIssue) => Instant | null) =>
  (issue: ExportIssue): CsvValue =>
    formatCairoDateTime(pick(issue));

/** Every export column, in the §7 default order. */
export const ISSUE_EXPORT_COLUMN_DEFS: readonly IssueExportColumnDef[] = [
  {
    key: 'number',
    label: { ar: 'الرقم', en: 'Number' },
    value: (i) => i.number,
  },
  {
    key: 'site',
    label: { ar: 'الموقع', en: 'Site' },
    value: (i) => i.site.name,
  },
  {
    key: 'status',
    label: { ar: 'الحالة', en: 'Status' },
    value: (i, { lang }) => STATUS_LABELS[lang][i.status],
  },
  {
    key: 'category',
    label: { ar: 'التصنيف', en: 'Category' },
    value: (i, { lang }) => i.category && exportCategoryName(i.category, lang),
  },
  {
    key: 'worker',
    label: { ar: 'المقاول', en: 'Worker' },
    value: (i) => i.worker?.name,
  },
  {
    key: 'workerPhone',
    label: { ar: 'هاتف المقاول', en: 'Worker phone' },
    value: (i) => i.worker?.phone,
  },
  {
    key: 'priority',
    label: { ar: 'الأولوية', en: 'Priority' },
    value: (i, { lang }) => PRIORITY_LABELS[lang][i.priority],
  },
  {
    key: 'description',
    label: { ar: 'الوصف', en: 'Description' },
    value: (i) => i.description,
  },
  {
    key: 'location',
    label: { ar: 'المكان', en: 'Location' },
    value: (i) => i.location,
  },
  {
    key: 'capturedAt',
    label: { ar: 'تاريخ التصوير', en: 'Captured at' },
    value: dateTime((i) => i.capturedAt),
  },
  {
    key: 'assignedAt',
    label: { ar: 'تاريخ الإسناد', en: 'Assigned at' },
    value: dateTime((i) => i.assignedAt),
  },
  {
    key: 'sentAt',
    label: { ar: 'تاريخ الإرسال', en: 'Sent at' },
    value: dateTime((i) => i.sentAt),
  },
  {
    key: 'estimatedDate',
    label: { ar: 'الموعد المتوقع', en: 'Estimated date' },
    value: (i) => i.estimatedDate,
  },
  {
    key: 'solvedAt',
    label: { ar: 'تاريخ الحل', en: 'Solved at' },
    value: dateTime((i) => i.solvedAt),
  },
  {
    key: 'overdue',
    label: { ar: 'متأخر', en: 'Overdue' },
    value: (i, { lang, now }) => yesNo(isOverdue(i, now), lang),
  },
  {
    key: 'daysOpen',
    label: { ar: 'أيام مفتوحة', en: 'Days open' },
    value: (i, { now, facts }) =>
      daysOpen(i, facts?.enteredStatusAt ?? null, now),
  },
  {
    key: 'photoLinks',
    label: { ar: 'روابط الصور', en: 'Photo links' },
    photoKind: 'before',
    pictureLabel: { ar: 'الصور', en: 'Photos' },
    value: (i) => photoLinks(i, 'before'),
  },
  {
    key: 'afterPhotoLinks',
    label: { ar: 'روابط صور بعد الإصلاح', en: 'After-photo links' },
    photoKind: 'after',
    pictureLabel: { ar: 'صور بعد الإصلاح', en: 'After photos' },
    value: (i) => photoLinks(i, 'after'),
  },
  {
    key: 'lastNote',
    label: { ar: 'آخر ملاحظة', en: 'Last note' },
    value: (_i, { facts }) => facts?.lastNote,
  },
];

const DEFS_BY_KEY = new Map(ISSUE_EXPORT_COLUMN_DEFS.map((d) => [d.key, d]));

/** The definition of one column. */
export const exportColumnDef = (key: IssueExportColumn): IssueExportColumnDef =>
  DEFS_BY_KEY.get(key)!;

/** Which file a column is named for: the issues CSV keeps photo links; the contractor Excel embeds pictures. */
export type ExportTarget = 'csv' | 'excel';

/** A column's name in `lang` for `target` — a photo-link column reads as pictures in the Excel. */
export const exportColumnLabel = (
  key: IssueExportColumn,
  lang: Locale,
  target: ExportTarget = 'csv',
): string => {
  const def = exportColumnDef(key);
  return (target === 'excel' && def.pictureLabel?.[lang]) || def.label[lang];
};

/** The columns to write: as requested and in that order, or all of §7 in its order. */
export const exportColumns = (
  requested: readonly IssueExportColumn[] | undefined,
): readonly IssueExportColumn[] => requested ?? ISSUE_EXPORT_COLUMNS;

/** The header row in `lang`. */
export const issueExportHeaders = (
  columns: readonly IssueExportColumn[],
  lang: Locale,
): string[] => columns.map((c) => exportColumnDef(c).label[lang]);

/** One issue as export cells, in `columns` order. */
export const issueExportCells = (
  issue: ExportIssue,
  columns: readonly IssueExportColumn[],
  ctx: ExportContext,
): CsvValue[] => columns.map((c) => exportColumnDef(c).value(issue, ctx));
