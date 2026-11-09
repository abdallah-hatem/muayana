import {
  ISSUE_EXPORT_COLUMNS,
  daysOpen,
  exportColumns,
  issueExportCells,
  type IssueStatus,
} from '@muayana/shared';
import {
  historyCells,
  historyFacts,
  issueCells,
  toExportIssue,
} from './issues-export.pure';
import type {
  HistoryExportRow,
  IssueChangeRow,
  IssueRow,
} from './repositories/issue.repository';

const NOW = new Date('2026-11-10T10:00:00Z');

function row(over: Partial<IssueRow> = {}): IssueRow {
  return {
    id: 'i1',
    siteId: 's1',
    number: 7,
    status: 'estimated',
    priority: 'high',
    description: '=SUM(A1)',
    location: 'Kitchen',
    formerWorkerName: null,
    estimatedDate: new Date('2026-11-08T00:00:00Z'),
    capturedAt: new Date('2026-11-01T08:00:00Z'),
    createdAt: new Date('2026-11-01T08:00:00Z'),
    updatedAt: new Date('2026-11-02T08:00:00Z'),
    assignedAt: new Date('2026-11-01T22:30:00Z'),
    sentAt: null,
    solvedAt: null,
    site: { id: 's1', name: 'Tower' },
    category: { id: 'c1', nameAr: 'دهان', nameEn: null, color: '#123456' },
    worker: { id: 'w1', name: 'Ali', phone: '+201001234567' },
    photos: [
      {
        id: 'p1',
        kind: 'before',
        url: 'http://x/a.jpg',
        width: 1,
        height: 1,
        sortOrder: 0,
        createdAt: NOW,
      },
      {
        id: 'p2',
        kind: 'after',
        url: 'http://x/b.jpg',
        width: 1,
        height: 1,
        sortOrder: 0,
        createdAt: NOW,
      },
      {
        id: 'p3',
        kind: 'before',
        url: 'http://x/c.jpg',
        width: 1,
        height: 1,
        sortOrder: 1,
        createdAt: NOW,
      },
    ],
    ...over,
  };
}

const change = (
  to: IssueStatus,
  at: string,
  note: string | null = null,
): IssueChangeRow => ({ issueId: 'i1', to, note, createdAt: new Date(at) });

describe('issues CSV cells (§7)', () => {
  it('Column list is the same single shared definition used by the issues CSV (API refactored to it)', () => {
    const facts = { lastNote: 'call him', enteredStatusAt: null };
    for (const lang of ['ar', 'en'] as const)
      expect(issueCells(row(), facts, ISSUE_EXPORT_COLUMNS, lang, NOW)).toEqual(
        issueExportCells(toExportIssue(row()), ISSUE_EXPORT_COLUMNS, {
          lang,
          now: NOW,
          facts,
        }),
      );
  });

  it('default columns are all of §7 in order; requested keep their order', () => {
    expect(exportColumns(undefined)[0]).toBe('number');
    expect(exportColumns(['status', 'number'])).toEqual(['status', 'number']);
  });

  it('writes labels in the language, Cairo times, overdue, links', () => {
    const cells = issueCells(
      row(),
      { lastNote: 'call him', enteredStatusAt: null },
      [
        'status',
        'priority',
        'category',
        'assignedAt',
        'estimatedDate',
        'overdue',
        'photoLinks',
        'afterPhotoLinks',
        'lastNote',
        'daysOpen',
      ],
      'en',
      NOW,
    );
    expect(cells).toEqual([
      'Estimated',
      'High',
      'دهان',
      '2026-11-02 00:30',
      '2026-11-08',
      'Yes',
      'http://x/a.jpg\nhttp://x/c.jpg',
      'http://x/b.jpg',
      'call him',
      9,
    ]);
    expect(
      issueCells(row(), undefined, ['overdue', 'status'], 'ar', NOW),
    ).toEqual(['نعم', 'تم تحديد موعد']);
  });

  it('days open stops when the issue was closed', () => {
    expect(
      daysOpen(
        row({ status: 'cancelled' }),
        new Date('2026-11-04T09:00:00Z'),
        NOW,
      ),
    ).toBe(3);
    expect(daysOpen(row(), null, NOW)).toBe(9);
  });

  it('history facts: newest note, newest move into the current status', () => {
    const facts = historyFacts(
      [
        change('solved', '2026-11-05T10:00:00Z'),
        change('in_progress', '2026-11-04T10:00:00Z', 'started'),
        change('solved', '2026-11-03T10:00:00Z', 'first fix'),
      ],
      new Map([['i1', 'solved' as const]]),
    );
    expect(facts.get('i1')).toEqual({
      lastNote: 'started',
      enteredStatusAt: new Date('2026-11-05T10:00:00Z'),
    });
  });

  it('history cells: no `from` on the first change', () => {
    const h: HistoryExportRow = {
      id: 'h1',
      from: null,
      to: 'new',
      note: null,
      createdAt: new Date('2026-11-05T22:05:00Z'),
      issue: { number: 3, site: { name: 'Tower' } },
    };
    expect(historyCells(h, 'en')).toEqual([
      'Tower',
      3,
      null,
      'New',
      '2026-11-06 00:05',
      null,
    ]);
  });
});
