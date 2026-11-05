import {
  emptyTally,
  openCount,
  overdueIssueWhere,
  tallyByKey,
  totalCount,
} from './issue-counts.util';
import { blankToNull } from './text.util';
import { triStateWhere } from './tri-state.util';

describe('issue counts', () => {
  it('tallies grouped rows per key and status', () => {
    const tallies = tallyByKey([
      { key: 'a', status: 'new', count: 2 },
      { key: 'a', status: 'assigned', count: 1 },
      { key: 'a', status: 'solved', count: 4 },
      { key: 'b', status: 'cancelled', count: 1 },
    ]);
    const a = tallies.get('a')!;
    expect(a.new).toBe(2);
    expect(openCount(a)).toBe(1);
    expect(totalCount(a)).toBe(7);
    expect(openCount(tallies.get('b')!)).toBe(0);
    expect(tallies.get('c')).toBeUndefined();
  });

  it('open = every status except new, solved and cancelled', () => {
    const tally = emptyTally();
    for (const s of Object.keys(tally) as (keyof typeof tally)[]) tally[s] = 1;
    expect(openCount(tally)).toBe(5);
  });

  it('overdue compares with today in Cairo, not UTC (22:30 UTC is already tomorrow in Cairo)', () => {
    const where = overdueIssueWhere(new Date('2026-11-05T22:30:00Z'));
    expect(where).toEqual({
      status: { notIn: ['solved', 'cancelled'] },
      estimatedDate: { lt: new Date('2026-11-06T00:00:00.000Z') },
    });
  });
});

describe('blankToNull / triStateWhere', () => {
  it('keeps undefined, clears blank, keeps text', () => {
    expect(blankToNull(undefined)).toBeUndefined();
    expect(blankToNull('')).toBeNull();
    expect(blankToNull('x')).toBe('x');
  });

  it('maps true/false/all to a boolean condition or none', () => {
    expect(triStateWhere('true')).toBe(true);
    expect(triStateWhere('false')).toBe(false);
    expect(triStateWhere('all')).toBeUndefined();
  });
});
