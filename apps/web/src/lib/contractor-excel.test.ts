// @vitest-environment node
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Issue, IssueExportColumn } from '@muayana/shared';
import { assignedIssue, makePhoto, makeWorker } from '@/test-utils/fixtures';
import {
  THUMB_LONG_SIDE,
  buildContractorWorkbook,
  issuesThatFit,
  workbookBytes,
  type ExcelRow,
  type Thumbnail,
} from './contractor-excel';
import { writeExcel } from './contractor-excel-flow';

const NOW = new Date('2026-11-10T10:00:00Z');
const worker = makeWorker({ name: 'Sayed', phone: '+201001234567' });

/** Random bytes: a JPEG doesn't compress further in the zip, and neither do these. */
const thumb = (size = 64): Thumbnail => ({
  bytes: crypto.getRandomValues(new Uint8Array(size)),
  width: THUMB_LONG_SIDE,
  height: 240,
});

/** An issue with `before` before-photos and `after` after-photos, all read as thumbnails. */
function row(
  over: Partial<Issue> = {},
  before = 1,
  after = 0,
  size = 64,
): ExcelRow {
  const photos = [
    ...Array.from({ length: before }, (_, i) =>
      makePhoto({ kind: 'before', sortOrder: i }),
    ),
    ...Array.from({ length: after }, (_, i) =>
      makePhoto({ kind: 'after', sortOrder: i }),
    ),
  ];
  return {
    issue: assignedIssue(worker, { photos, ...over }),
    pictures: {
      before: Array.from({ length: before }, () => thumb(size)),
      after: Array.from({ length: after }, () => thumb(size)),
    },
  };
}

/** Builds, writes and reads the file back the way Excel would open it. */
async function roundTrip(
  rows: ExcelRow[],
  columns: IssueExportColumn[],
  lang: 'ar' | 'en',
) {
  const workbook = buildContractorWorkbook(ExcelJS, {
    rows,
    columns,
    lang,
    now: NOW,
    sheetName: worker.name,
  });
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(
    (await workbookBytes(workbook)).buffer as unknown as ArrayBuffer,
  );
  return read.worksheets[0];
}

const rowValues = (sheet: ExcelJS.Worksheet, n: number) =>
  (sheet.getRow(n).values as unknown[]).slice(1);

describe('contractor Excel workbook (§5.5, §7)', () => {
  it('Chosen columns only, in order; header language ar/en (§7)', async () => {
    const rows = [row({ number: 11, description: 'Crack' }, 0)];
    const columns: IssueExportColumn[] = ['status', 'number', 'description'];

    const ar = await roundTrip(rows, columns, 'ar');
    expect(rowValues(ar, 1)).toEqual(['الحالة', 'الرقم', 'الوصف']);
    expect(rowValues(ar, 2)).toEqual(['مُسند', 11, 'Crack']);
    expect(ar.actualColumnCount).toBe(3);

    const en = await roundTrip(rows, columns, 'en');
    expect(rowValues(en, 1)).toEqual(['Status', 'Number', 'Description']);
    expect(rowValues(en, 2)).toEqual(['Assigned', 11, 'Crack']);
  });

  it('Photos embedded as images in their row (thumbnails ≤320px), not links; RTL sheet in ar (§7)', async () => {
    const rows = [row({ number: 1 }, 2, 1), row({ number: 2 }, 1, 0)];
    const sheet = await roundTrip(
      rows,
      ['number', 'photoLinks', 'afterPhotoLinks'],
      'ar',
    );
    expect(sheet.views[0].rightToLeft).toBe(true);

    const images = sheet.getImages();
    // Issue 1: two before + one after; issue 2: one before.
    expect(images).toHaveLength(4);
    const at = images
      .map((i) => [i.range.tl.nativeRow, i.range.tl.nativeCol])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // Row index 1 = the first issue's row, 2 = the second's. Columns: number (0), before
    // photos (1, 2 — two cells, the most any issue has), after photos (3).
    expect(at).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
    ]);
    // The picture rows are tall enough to show them.
    expect(sheet.getRow(2).height).toBeGreaterThan(60);
    // Headers name the pictures, not links; the before header spans its two photo cells.
    expect(rowValues(sheet, 1)).toEqual([
      'الرقم',
      'الصور',
      'الصور',
      'صور بعد الإصلاح',
    ]);

    const en = await roundTrip(rows, ['number'], 'en');
    expect(en.views[0].rightToLeft).toBe(false);
  });

  it('Photo-link columns are replaced by embedded pictures, never URLs in cells (§7)', async () => {
    const rows = [row({ number: 5 }, 3, 2)];
    const sheet = await roundTrip(
      rows,
      ['photoLinks', 'afterPhotoLinks', 'description'],
      'en',
    );
    const cells: unknown[] = [];
    sheet.eachRow((r) => cells.push(...(r.values as unknown[])));
    const text = cells.filter((v) => typeof v === 'string').join(' ');
    expect(text).not.toMatch(/https?:\/\//);
    expect(sheet.getImages()).toHaveLength(5);
  });

  it('Formula guard on text cells (§7)', async () => {
    const rows = [
      row(
        {
          number: 3,
          description: '=HYPERLINK("http://evil")',
          location: '+201',
        },
        0,
      ),
    ];
    const sheet = await roundTrip(
      rows,
      ['number', 'description', 'location'],
      'en',
    );
    expect(rowValues(sheet, 2)).toEqual([
      3,
      `'=HYPERLINK("http://evil")`,
      "'+201",
    ]);
    // Written as text, never as a formula cell.
    expect(sheet.getCell(2, 2).type).toBe(ExcelJS.ValueType.String);
  });

  it('File > ~15 MB → warning, offer fewer issues (§5.5)', async () => {
    const rows = [1, 2, 3, 4].map((n) => row({ number: n }, 1, 0, 40_000));
    const built = await writeExcel({
      rows,
      columns: ['number', 'photoLinks'],
      lang: 'ar',
      now: NOW,
      workerName: worker.name,
      maxBytes: 100_000,
    });
    expect(built.kind).toBe('tooBig');
    if (built.kind !== 'tooBig') return;
    expect(built.total).toBe(4);
    expect(built.fit).toBeGreaterThanOrEqual(1);
    expect(built.fit).toBeLessThan(4);

    const fewer = await writeExcel({
      rows: rows.slice(0, built.fit),
      columns: ['number', 'photoLinks'],
      lang: 'ar',
      now: NOW,
      workerName: worker.name,
      maxBytes: 100_000,
    });
    expect(fewer.kind).toBe('file');
    if (fewer.kind === 'file') {
      expect(fewer.file.name).toMatch(/^Sayed-2026-11-10\.xlsx$/);
      expect(fewer.file.size).toBeLessThanOrEqual(100_000);
    }

    expect(issuesThatFit([], 0)).toBe(0);
    expect(issuesThatFit(rows, 10_000_000, 1)).toBe(1);
  });
});
