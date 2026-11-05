import {
  buildIssueWhere,
  cairoDayStart,
  dateOnlyToDb,
  dbToDateOnly,
  issueOrderBy,
} from './issue-filter.util';

const NOW = new Date('2026-11-05T12:00:00Z');

describe('cairoDayStart', () => {
  it('winter day starts at 22:00Z the day before (UTC+2)', () => {
    expect(cairoDayStart('2026-03-10').toISOString()).toBe(
      '2026-03-09T22:00:00.000Z',
    );
  });

  it('summer day starts at 21:00Z the day before (UTC+3)', () => {
    expect(cairoDayStart('2026-07-10').toISOString()).toBe(
      '2026-07-09T21:00:00.000Z',
    );
  });
});

describe('date-only round trip', () => {
  it('YYYY-MM-DD ↔ UTC midnight', () => {
    expect(dbToDateOnly(dateOnlyToDb('2026-02-28'))).toBe('2026-02-28');
    expect(dbToDateOnly(null)).toBeNull();
  });
});

describe('buildIssueWhere', () => {
  it('no filter → match everything', () => {
    expect(buildIssueWhere({}, NOW)).toEqual({});
  });

  it('ids, status and priority lists are ANDed', () => {
    expect(
      buildIssueWhere(
        {
          siteId: 's',
          categoryId: 'c',
          workerId: 'w',
          status: ['new', 'sent'],
          priority: ['urgent'],
        },
        NOW,
      ),
    ).toEqual({
      AND: [
        { siteId: 's' },
        { categoryId: 'c' },
        { workerId: 'w' },
        { status: { in: ['new', 'sent'] } },
        { priority: { in: ['urgent'] } },
      ],
    });
  });

  it('captured range is inclusive of both Cairo days', () => {
    const where = buildIssueWhere(
      { capturedFrom: '2026-03-10', capturedTo: '2026-03-11' },
      NOW,
    );
    expect(where).toEqual({
      AND: [
        {
          capturedAt: {
            gte: new Date('2026-03-09T22:00:00.000Z'),
            lt: new Date('2026-03-11T22:00:00.000Z'),
          },
        },
      ],
    });
  });

  it('overdue compares with today in Cairo and skips closed issues', () => {
    expect(buildIssueWhere({ overdue: true }, NOW)).toEqual({
      AND: [
        {
          estimatedDate: { lt: new Date('2026-11-05T00:00:00.000Z') },
          status: { notIn: ['solved', 'cancelled'] },
        },
      ],
    });
  });

  it('q matches a number only when it looks like one', () => {
    const numeric = buildIssueWhere({ q: '#12' }, NOW);
    expect(JSON.stringify(numeric)).toContain('"number":12');
    const text = buildIssueWhere({ q: 'pipe' }, NOW);
    expect(JSON.stringify(text)).not.toContain('"number"');
  });
});

describe('issueOrderBy', () => {
  it('every order ends on the id', () => {
    for (const sort of ['newest', 'oldest', 'priority', 'estimate'] as const) {
      expect(issueOrderBy(sort).at(-1)).toEqual({ id: 'asc' });
    }
  });

  it('estimate puts issues without a date last', () => {
    expect(issueOrderBy('estimate')[0]).toEqual({
      estimatedDate: { sort: 'asc', nulls: 'last' },
    });
  });
});
