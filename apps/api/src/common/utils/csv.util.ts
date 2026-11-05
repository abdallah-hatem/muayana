import { StreamableFile } from '@nestjs/common';
import {
  CSV_BOM,
  csvRow,
  type CategoryRef,
  type CsvValue,
  type IssueStatus,
  type Locale,
  type Priority,
} from '@muayana/shared';
import { Readable } from 'node:stream';

/*
 * What every CSV export shares (business §7): the labels written in the export language, and
 * the streamed file itself. Text cells are formula-guarded by csvRow (@muayana/shared).
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
    sent: 'أُرسل للعامل',
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

/** A category's name in the export language (English falls back to Arabic). */
export const categoryName = (category: CategoryRef, lang: Locale): string =>
  lang === 'en' ? (category.nameEn ?? category.nameAr) : category.nameAr;

/**
 * A CSV answer built while it is sent: the BOM and header row first, then each batch of rows
 * as the database returns it, so an export of every matching row never sits in memory whole.
 */
export function csvStream(
  headers: readonly string[],
  batches: AsyncIterable<readonly (readonly CsvValue[])[]>,
): StreamableFile {
  async function* lines(): AsyncGenerator<string> {
    yield CSV_BOM + csvRow(headers);
    for await (const rows of batches) {
      if (rows.length > 0) yield rows.map(csvRow).join('');
    }
  }
  return new StreamableFile(Readable.from(lines()), {
    type: 'text/csv; charset=utf-8',
  });
}
