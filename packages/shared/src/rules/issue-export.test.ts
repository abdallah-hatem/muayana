import { describe, expect, it } from 'vitest';
import {
  ISSUE_EXPORT_COLUMNS,
  ISSUE_EXPORT_COLUMN_DEFS,
  daysOpen,
  escapeCsvCell,
  exportColumnLabel,
  guardFormula,
  issueExportCells,
  issueExportHeaders,
  issueHistoryFacts,
  type ExportIssue,
} from '../index';

const NOW = new Date('2026-11-10T10:00:00Z');

const issue = (over: Partial<ExportIssue> = {}): ExportIssue => ({
  number: 7,
  site: { name: 'Tower' },
  status: 'assigned',
  priority: 'high',
  description: '=SUM(A1)',
  location: null,
  category: { nameAr: 'دهان', nameEn: null },
  worker: { name: 'Sayed', phone: '+201001234567' },
  estimatedDate: null,
  capturedAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-02T08:00:00.000Z',
  assignedAt: '2026-11-01T22:30:00.000Z',
  sentAt: null,
  solvedAt: null,
  photos: [
    { kind: 'before', url: 'http://x/a.jpg' },
    { kind: 'after', url: 'http://x/b.jpg' },
  ],
  ...over,
});

describe('shared issue export columns (§7)', () => {
  it('Column list is the same single shared definition used by the issues CSV: every §7 column once, in order', () => {
    expect(ISSUE_EXPORT_COLUMN_DEFS.map((d) => d.key)).toEqual([
      ...ISSUE_EXPORT_COLUMNS,
    ]);
    // Only the two photo-link columns turn into pictures in the Excel.
    expect(
      ISSUE_EXPORT_COLUMN_DEFS.filter((d) => d.photoKind).map((d) => [
        d.key,
        d.photoKind,
      ]),
    ).toEqual([
      ['photoLinks', 'before'],
      ['afterPhotoLinks', 'after'],
    ]);
  });

  it('Photo-link columns are named as pictures in the Excel and as links in the CSV', () => {
    expect(exportColumnLabel('photoLinks', 'ar', 'excel')).toBe('الصور');
    expect(exportColumnLabel('afterPhotoLinks', 'en', 'excel')).toBe(
      'After photos',
    );
    expect(exportColumnLabel('photoLinks', 'en')).toBe('Photo links');
    expect(exportColumnLabel('status', 'ar', 'excel')).toBe('الحالة');
  });

  it('Chosen columns only, in order; header language ar/en', () => {
    expect(issueExportHeaders(['status', 'number'], 'ar')).toEqual([
      'الحالة',
      'الرقم',
    ]);
    expect(issueExportHeaders(['status', 'number'], 'en')).toEqual([
      'Status',
      'Number',
    ]);
    expect(
      issueExportCells(issue(), ['category', 'status', 'assignedAt'], {
        lang: 'en',
        now: NOW,
      }),
    ).toEqual(['دهان', 'Assigned', '2026-11-02 00:30']);
  });

  it('reads string instants (the web Issue) the same as Dates (the API row)', () => {
    const asDates = issue({
      capturedAt: new Date('2026-11-01T08:00:00Z'),
      updatedAt: new Date('2026-11-02T08:00:00Z'),
      assignedAt: new Date('2026-11-01T22:30:00Z'),
    });
    const ctx = { lang: 'ar' as const, now: NOW };
    expect(issueExportCells(asDates, ISSUE_EXPORT_COLUMNS, ctx)).toEqual(
      issueExportCells(issue(), ISSUE_EXPORT_COLUMNS, ctx),
    );
  });

  it('days open stops at the closing move; history facts take the newest note and move', () => {
    const facts = issueHistoryFacts(
      [
        { to: 'solved', note: null, createdAt: '2026-11-05T10:00:00Z' },
        {
          to: 'in_progress',
          note: 'started',
          createdAt: '2026-11-04T10:00:00Z',
        },
        { to: 'solved', note: 'first fix', createdAt: '2026-11-03T10:00:00Z' },
      ],
      'solved',
    );
    expect(facts).toEqual({
      lastNote: 'started',
      enteredStatusAt: '2026-11-05T10:00:00Z',
    });
    expect(
      daysOpen(issue({ status: 'solved' }), facts.enteredStatusAt, NOW),
    ).toBe(4);
    expect(issueHistoryFacts([], undefined)).toEqual({
      lastNote: null,
      enteredStatusAt: null,
    });
  });

  it('Formula guard on text cells: the one guard the CSV uses', () => {
    for (const start of ['=', '+', '-', '@', '\t', '\r'])
      expect(guardFormula(`${start}x`)).toBe(`'${start}x`);
    expect(guardFormula('plain')).toBe('plain');
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell(-3)).toBe('-3');
  });

  it("keep: the export shows the deleted contractor's former name marked deleted (§3)", () => {
    const kept = issue({
      status: 'solved',
      worker: null,
      formerWorkerName: 'Sayed',
    });
    const ctx = (lang: 'ar' | 'en') => ({ lang, now: NOW });
    expect(
      issueExportCells(kept, ['worker', 'workerPhone'], ctx('en')),
    ).toEqual(['Sayed (deleted)', undefined]);
    expect(issueExportCells(kept, ['worker'], ctx('ar'))).toEqual([
      'Sayed (محذوف)',
    ]);
    // A current worker wins; no worker and no former name → empty.
    expect(
      issueExportCells(
        issue({ formerWorkerName: 'Old' }),
        ['worker'],
        ctx('en'),
      ),
    ).toEqual(['Sayed']);
    expect(
      issueExportCells(issue({ worker: null }), ['worker'], ctx('en')),
    ).toEqual([null]);
  });
});
