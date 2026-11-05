import { summarize, type IssueGroup } from './dashboard.pure';

const g = (
  status: IssueGroup['status'],
  count: number,
  over: Partial<IssueGroup> = {},
): IssueGroup => ({
  siteId: 's1',
  categoryId: 'c1',
  workerId: 'w1',
  status,
  count,
  ...over,
});

describe('summarize (§5.9)', () => {
  it('counts every status, inbox = new, open per category / worker / site', () => {
    const s = summarize(
      [
        g('new', 3, { categoryId: null, workerId: null }),
        g('unassigned', 2, { workerId: null }),
        g('sent', 1),
        g('solved', 4),
        g('in_progress', 1, { siteId: 's2', categoryId: 'c2', workerId: 'w2' }),
      ],
      [],
    );
    expect(s.byStatus).toMatchObject({
      new: 3,
      unassigned: 2,
      sent: 1,
      solved: 4,
      in_progress: 1,
      cancelled: 0,
    });
    expect(s.inbox).toBe(3);
    expect(s.byCategory.get('c1')).toEqual({ open: 3, overdue: 0 });
    expect(s.byWorker.get('w1')).toEqual({ open: 1, overdue: 0 });
    expect(s.bySite.get('s1')).toEqual({ open: 3, new: 3, overdue: 0 });
    expect(s.bySite.get('s2')).toEqual({ open: 1, new: 0, overdue: 0 });
  });

  it('closed-only keys are left out; overdue adds to its keys and the total', () => {
    const s = summarize(
      [g('solved', 2, { categoryId: 'c9', workerId: 'w9' })],
      [{ siteId: 's1', categoryId: 'c1', workerId: null, count: 2 }],
    );
    expect(s.byCategory.has('c9')).toBe(false);
    expect(s.byWorker.has('w9')).toBe(false);
    expect(s.overdue).toBe(2);
    expect(s.byCategory.get('c1')).toEqual({ open: 0, overdue: 2 });
    expect(s.bySite.get('s1')).toEqual({ open: 0, new: 0, overdue: 2 });
    expect(s.byWorker.size).toBe(0);
  });
});
