import {
  exportCategoryName,
  yesNo,
  toAsciiDigits,
  toCsv,
  type CategoryRef,
  type Locale,
  type Worker,
  type WorkerIssuesSummary,
} from '@muayana/shared';
import {
  emptyTally,
  openCount,
  totalCount,
  type StatusTally,
} from '../../common/utils/issue-counts.util';
import type { WorkerRow } from './repositories/workers.repository';

/** A worker row plus his issue counts, as the contract's `Worker` (categories in display order). */
export function toWorker(
  row: WorkerRow,
  tally: StatusTally = emptyTally(),
  overdue = 0,
): Worker {
  const categories: CategoryRef[] = row.categories
    .map(({ category }) => category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _order, ...ref }) => ref);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    active: row.active,
    categories,
    counts: {
      assigned: tally.assigned,
      sent: tally.sent,
      estimated: tally.estimated,
      in_progress: tally.in_progress,
      solved: tally.solved,
      cancelled: tally.cancelled,
      open: openCount(tally),
      overdue,
    },
  };
}

/**
 * The digits of a search to match against stored phones (`+2010…`): Arabic-Indic digits
 * converted, separators dropped, and the local trunk zero dropped so `010 12` finds `+201012…`.
 * Null when the search has no digits to match.
 */
export function phoneSearchDigits(search: string): string | null {
  const digits = toAsciiDigits(search).replace(/\D/g, '').replace(/^0+/, '');
  return digits === '' ? null : digits;
}

/**
 * Categories a save adds that are inactive (business §6.11: a deactivated category can't be
 * newly chosen; ones the worker already has may stay).
 */
export function newlyAddedInactive(
  requested: readonly { id: string; active: boolean }[],
  current: readonly string[],
): string[] {
  const has = new Set(current);
  return requested.filter((c) => !c.active && !has.has(c.id)).map((c) => c.id);
}

const CSV_HEADERS: Record<Locale, readonly string[]> = {
  ar: [
    'الاسم',
    'الهاتف',
    'التخصصات',
    'نشط',
    'ملاحظات',
    'مُسند',
    'أُرسل للمقاول',
    'تم تحديد موعد',
    'جاري العمل',
    'تم الحل',
    'مفتوح',
    'متأخر',
  ],
  en: [
    'Name',
    'Phone',
    'Categories',
    'Active',
    'Notes',
    'Assigned',
    'Sent',
    'Estimated',
    'In progress',
    'Solved',
    'Open',
    'Overdue',
  ],
};

/**
 * The workers CSV (business §7): BOM, headers in `lang`, one row per worker with categories,
 * phone, active, notes and his counts per status, open and overdue. Text cells are
 * formula-guarded by toCsv.
 */
export function workersCsv(workers: readonly Worker[], lang: Locale): string {
  return toCsv(
    workers.map((w) => [
      w.name,
      w.phone,
      w.categories.map((c) => exportCategoryName(c, lang)).join(' / '),
      yesNo(w.active, lang),
      w.notes,
      w.counts.assigned,
      w.counts.sent,
      w.counts.estimated,
      w.counts.in_progress,
      w.counts.solved,
      w.counts.open,
      w.counts.overdue,
    ]),
    CSV_HEADERS[lang],
  );
}

/** The `data` of a 409 WORKER_HAS_ISSUES: what deleting him would touch (business §3, §6.8). */
export function workerIssuesSummary(
  tally: StatusTally,
  photos: number,
): WorkerIssuesSummary {
  return {
    open: openCount(tally),
    solved: tally.solved,
    cancelled: tally.cancelled,
    total: totalCount(tally),
    photos,
  };
}

/**
 * The history note on each open issue a deleted contractor leaves behind ("keep the issues",
 * §3). Both languages: the note is shown as written, whatever the reader's language.
 */
export const deletedContractorNote = (name: string): string =>
  `حُذف المقاول «${name}» · Contractor ${name} was deleted`;
