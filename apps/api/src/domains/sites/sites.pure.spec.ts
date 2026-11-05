import { emptyTally } from '../../common/utils/issue-counts.util';
import { needsNameCheck, toSite } from './sites.pure';

describe('needsNameCheck', () => {
  const live = { nameKey: 'tower', archived: false };

  it('renaming a live site is checked', () => {
    expect(needsNameCheck(live, { nameKey: 'other', archived: false })).toBe(
      true,
    );
  });

  it('saving a live site under its own name is not', () => {
    expect(needsNameCheck(live, { nameKey: 'tower', archived: false })).toBe(
      false,
    );
  });

  it('unarchiving is checked even without a rename (§3)', () => {
    expect(
      needsNameCheck(
        { nameKey: 'tower', archived: true },
        { nameKey: 'tower', archived: false },
      ),
    ).toBe(true);
  });

  it('a site that ends up archived is never checked', () => {
    expect(needsNameCheck(live, { nameKey: 'other', archived: true })).toBe(
      false,
    );
  });
});

describe('toSite', () => {
  it('adds counts: open, new, overdue, total', () => {
    const tally = { ...emptyTally(), new: 2, sent: 1, solved: 3 };
    const site = toSite(
      {
        id: 'id',
        name: 'A',
        address: null,
        notes: null,
        archived: false,
        createdAt: new Date('2026-11-05T10:00:00Z'),
        nextNumber: 7,
      },
      tally,
      1,
    );
    expect(site.createdAt).toBe('2026-11-05T10:00:00.000Z');
    expect(site.counts).toEqual({ open: 1, new: 2, overdue: 1, total: 6 });
  });
});
