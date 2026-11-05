import type { IssueState } from '@muayana/shared';
import {
  firstReachedStamp,
  planMove,
  resolveTarget,
  toIssue,
} from './issues.pure';
import type { IssueRow } from './repositories/issue.repository';

const NOW = new Date('2026-11-05T12:00:00Z');

const state = (over: Partial<IssueState> = {}): IssueState => ({
  status: 'assigned',
  categoryId: 'cat',
  description: 'Crack',
  workerId: 'w',
  estimatedDate: null,
  ...over,
});

describe('toIssue', () => {
  const row = {
    id: 'i',
    siteId: 's',
    number: 4,
    status: 'estimated',
    priority: 'normal',
    description: 'x',
    location: null,
    estimatedDate: new Date('2026-11-01T00:00:00Z'),
    capturedAt: new Date('2026-10-01T08:00:00Z'),
    createdAt: new Date('2026-10-01T09:00:00Z'),
    updatedAt: new Date('2026-10-02T09:00:00Z'),
    assignedAt: null,
    sentAt: null,
    solvedAt: null,
    site: { id: 's', name: 'Tower' },
    category: null,
    worker: null,
    photos: [],
  } as unknown as IssueRow;

  it('dates as ISO, estimate as YYYY-MM-DD, overdue computed', () => {
    expect(toIssue(row, NOW)).toMatchObject({
      estimatedDate: '2026-11-01',
      capturedAt: '2026-10-01T08:00:00.000Z',
      assignedAt: null,
      overdue: true,
    });
  });

  it('a solved issue is never overdue', () => {
    expect(toIssue({ ...row, status: 'solved' }, NOW).overdue).toBe(false);
  });
});

describe('firstReachedStamp', () => {
  const none = { assignedAt: null, sentAt: null, solvedAt: null };

  it('stamps the first arrival only', () => {
    expect(firstReachedStamp(none, 'sent', NOW)).toEqual({ sentAt: NOW });
    expect(
      firstReachedStamp({ ...none, sentAt: new Date(0) }, 'sent', NOW),
    ).toEqual({});
  });

  it('statuses without a timestamp stamp nothing', () => {
    expect(firstReachedStamp(none, 'in_progress', NOW)).toEqual({});
  });
});

describe('resolveTarget', () => {
  it('reopening lands on assigned with a worker, unassigned without', () => {
    expect(resolveTarget(state({ status: 'solved' }), 'unassigned')).toBe(
      'assigned',
    );
    expect(
      resolveTarget(state({ status: 'cancelled', workerId: null }), 'assigned'),
    ).toBe('unassigned');
  });

  it('other moves are left alone', () => {
    expect(resolveTarget(state(), 'unassigned')).toBe('unassigned');
    expect(resolveTarget(state({ status: 'solved' }), 'sent')).toBe('sent');
  });
});

describe('planMove', () => {
  it('the current status is not a move', () => {
    expect(planMove(state(), 'assigned')).toEqual({
      ok: true,
      state: state(),
      moved: false,
    });
  });

  it('merges the estimated date before checking the target', () => {
    expect(planMove(state(), 'estimated', '2026-12-01')).toEqual({
      ok: true,
      state: state({ status: 'estimated', estimatedDate: '2026-12-01' }),
      moved: true,
    });
    expect(planMove(state(), 'estimated')).toMatchObject({
      ok: false,
      missing: ['estimatedDate'],
    });
  });

  it('back to new is refused', () => {
    expect(planMove(state(), 'new')).toMatchObject({
      ok: false,
      code: 'BACK_TO_NEW',
    });
  });
});
