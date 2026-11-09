import {
  exportColumnDef,
  exportColumnLabel,
  guardFormula,
  type CsvValue,
  type ExportIssue,
  type HistoryFacts,
  type IssueExportColumn,
  type Locale,
  type PhotoKind,
} from '@muayana/shared';
import type { Workbook } from 'exceljs';

/*
 * The contractor Excel (business §5.5, §7): the chosen export columns of the one shared list, in
 * order, headers in the app's language; each issue's photos embedded in its row as small pictures
 * in place of the photo-link columns (never URLs); right-to-left sheet in Arabic. Built on the
 * phone, so the exceljs module is handed in (loaded only when the action runs).
 */

/** The file must stay under about this size to go through WhatsApp comfortably (§5.5). */
export const EXCEL_MAX_BYTES = 15 * 1024 * 1024;

/** Thumbnails embedded in the file: long side in pixels (§5.5). */
export const THUMB_LONG_SIDE = 320;

/** How big a picture shows in its cell (long side, px); the embedded image keeps 320px. */
export const PICTURE_DISPLAY = 120;
const ROW_PADDING_PX = 8;
/** Excel column width unit ≈ 7px of the default font. */
const PX_PER_WIDTH_UNIT = 7;
/** Row heights are in points (0.75 per pixel). */
const POINTS_PER_PX = 0.75;

/** One embedded picture: JPEG bytes and its pixel size. */
export interface Thumbnail {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** One issue of the file: the issue, its history facts, and its photos' thumbnails by kind. */
export interface ExcelRow {
  issue: ExportIssue;
  facts?: HistoryFacts;
  /** Thumbnails in photo order; `null` where one couldn't be read (its cell stays empty). */
  pictures: Partial<Record<PhotoKind, (Thumbnail | null)[]>>;
}

/** One sheet column group: a value column, or a picture column spanning one cell per photo. */
type Slot =
  | { column: IssueExportColumn; kind: 'value'; header: string }
  | {
      column: IssueExportColumn;
      kind: 'pictures';
      header: string;
      photoKind: PhotoKind;
      span: number;
    };

const WIDE_COLUMNS: ReadonlySet<IssueExportColumn> = new Set([
  'description',
  'location',
  'lastNote',
  'site',
]);

/** The sheet layout: chosen columns in order; photo-link columns become picture columns. */
export function excelSlots(
  rows: readonly ExcelRow[],
  columns: readonly IssueExportColumn[],
  lang: Locale,
): Slot[] {
  return columns.map((column) => {
    const def = exportColumnDef(column);
    const header = exportColumnLabel(column, lang, 'excel');
    if (!def.photoKind) return { column, kind: 'value', header };
    const kind = def.photoKind;
    const span = Math.max(
      1,
      ...rows.map((r) => r.issue.photos.filter((p) => p.kind === kind).length),
    );
    return {
      column,
      kind: 'pictures',
      header,
      photoKind: kind,
      span,
    };
  });
}

/** A text cell guarded against formulas (§7); numbers stay numbers, empty stays empty. */
export const excelCellValue = (value: CsvValue): string | number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  return guardFormula(String(value));
};

/** A picture's display size: long side PICTURE_DISPLAY, aspect kept. */
export const displaySize = (
  thumb: Pick<Thumbnail, 'width' | 'height'>,
): { width: number; height: number } => {
  const scale = PICTURE_DISPLAY / Math.max(thumb.width, thumb.height, 1);
  return {
    width: Math.max(1, Math.round(thumb.width * scale)),
    height: Math.max(1, Math.round(thumb.height * scale)),
  };
};

/** Bytes → base64 (exceljs takes base64 the same in the browser and in node). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP)
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  return btoa(binary);
}

/**
 * The workbook for `rows`: one sheet, a header row, one row per issue. `ExcelJS` is the loaded
 * exceljs module (dynamic import on the phone, the node build in tests).
 */
export function buildContractorWorkbook(
  ExcelJS: { Workbook: new () => Workbook },
  {
    rows,
    columns,
    lang,
    now,
    sheetName,
  }: {
    rows: readonly ExcelRow[];
    columns: readonly IssueExportColumn[];
    lang: Locale;
    now: Date;
    sheetName: string;
  },
): Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.created = now;
  const sheet = workbook.addWorksheet(safeSheetName(sheetName), {
    views: [{ rightToLeft: lang === 'ar', state: 'frozen', ySplit: 1 }],
  });

  const slots = excelSlots(rows, columns, lang);
  const hasPictures = slots.some(
    (s) =>
      s.kind === 'pictures' &&
      rows.some((r) => (r.pictures[s.photoKind] ?? []).some(Boolean)),
  );

  // Column widths and the header row (a picture column's header spans its photo cells).
  const header = sheet.getRow(1);
  let col = 1;
  for (const slot of slots) {
    if (slot.kind === 'value') {
      sheet.getColumn(col).width = WIDE_COLUMNS.has(slot.column) ? 40 : 16;
      header.getCell(col).value = slot.header;
      col += 1;
    } else {
      for (let i = 0; i < slot.span; i += 1)
        sheet.getColumn(col + i).width =
          (PICTURE_DISPLAY + ROW_PADDING_PX) / PX_PER_WIDTH_UNIT;
      header.getCell(col).value = slot.header;
      if (slot.span > 1) sheet.mergeCells(1, col, 1, col + slot.span - 1);
      col += slot.span;
    }
  }
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', wrapText: true };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sheetRow = sheet.getRow(rowNumber);
    sheetRow.alignment = { vertical: 'top', wrapText: true };
    const ctx = { lang, now, facts: row.facts };
    let c = 1;
    for (const slot of slots) {
      if (slot.kind === 'value') {
        sheetRow.getCell(c).value = excelCellValue(
          exportColumnDef(slot.column).value(row.issue, ctx),
        );
        c += 1;
        continue;
      }
      (row.pictures[slot.photoKind] ?? []).forEach((thumb, i) => {
        if (!thumb || i >= slot.span) return;
        const imageId = workbook.addImage({
          base64: toBase64(thumb.bytes),
          extension: 'jpeg',
        });
        // Anchors are 0-based: column c + i is index c + i - 1, the row index rowNumber - 1.
        sheet.addImage(imageId, {
          tl: { col: c + i - 1, row: rowNumber - 1 },
          ext: displaySize(thumb),
          editAs: 'oneCell',
        });
      });
      c += slot.span;
    }
    if (hasPictures)
      sheetRow.height = (PICTURE_DISPLAY + ROW_PADDING_PX) * POINTS_PER_PX;
  });

  return workbook;
}

/** Sheet names: at most 31 characters, none of `[]:*?/\`. */
export const safeSheetName = (name: string): string =>
  name
    .replace(/[[\]:*?/\\]/g, ' ')
    .trim()
    .slice(0, 31) || 'Sheet1';

/** The written .xlsx. */
export async function workbookBytes(workbook: Workbook): Promise<Uint8Array> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/** About what one issue adds to the file: its pictures plus its text. */
export const rowBytes = (row: ExcelRow): number =>
  Object.values(row.pictures)
    .flat()
    .reduce((sum, t) => sum + (t?.bytes.byteLength ?? 0), 0) + 1024;

/**
 * How many leading issues fit in `limit` bytes, given the file came out at `actual` bytes for
 * all of them (scaled from each row's share). At least 1 when there are rows.
 */
export function issuesThatFit(
  rows: readonly ExcelRow[],
  actual: number,
  limit: number = EXCEL_MAX_BYTES,
): number {
  if (rows.length === 0) return 0;
  const sizes = rows.map(rowBytes);
  const estimated = sizes.reduce((a, b) => a + b, 0);
  const overhead = Math.max(0, actual - estimated);
  let total = overhead;
  let count = 0;
  for (const size of sizes) {
    if (total + size > limit) break;
    total += size;
    count += 1;
  }
  return Math.max(1, count);
}
