import { OPEN_STATUSES, type IssueStatus } from '@muayana/shared';
import {
  emptyTally,
  type StatusTally,
} from '../../common/utils/issue-counts.util';

/** A `groupBy([siteId, categoryId, workerId, status])` row. */
export interface IssueGroup {
  siteId: string;
  categoryId: string | null;
  workerId: string | null;
  status: IssueStatus;
  count: number;
}

/** A `groupBy([siteId, categoryId, workerId])` row of overdue issues. */
export type OverdueGroup = Omit<IssueGroup, 'status'>;

export interface OpenCounts {
  open: number;
  overdue: number;
}

export interface SiteCounts extends OpenCounts {
  new: number;
}

/** The dashboard's numbers, keyed by id; the service attaches the names. */
export interface DashboardSummary {
  byStatus: StatusTally;
  overdue: number;
  inbox: number;
  byCategory: Map<string, OpenCounts>;
  byWorker: Map<string, OpenCounts>;
  bySite: Map<string, SiteCounts>;
}

const isOpen = (status: IssueStatus): boolean => OPEN_STATUSES.includes(status);

function bump<T extends OpenCounts>(
  map: Map<string, T>,
  key: string | null,
  empty: () => T,
  add: Partial<T>,
): void {
  if (key === null) return;
  const counts = map.get(key) ?? empty();
  for (const [field, n] of Object.entries(add) as [keyof T, number][])
    (counts[field] as number) += n;
  map.set(key, counts);
}

const noCounts = (): OpenCounts => ({ open: 0, overdue: 0 });
const noSiteCounts = (): SiteCounts => ({ open: 0, new: 0, overdue: 0 });

/**
 * Folds the grouped counts into the dashboard (business §5.9): issues per status, overdue,
 * the inbox (= `new`), and open (§4: sorted, not solved or cancelled) + overdue per category,
 * worker and site; `new` per site too. Overdue never includes a closed issue (§4).
 */
export function summarize(
  groups: readonly IssueGroup[],
  overdue: readonly OverdueGroup[],
): DashboardSummary {
  const summary: DashboardSummary = {
    byStatus: emptyTally(),
    overdue: 0,
    inbox: 0,
    byCategory: new Map(),
    byWorker: new Map(),
    bySite: new Map(),
  };
  for (const g of groups) {
    summary.byStatus[g.status] += g.count;
    const open = isOpen(g.status) ? g.count : 0;
    const fresh = g.status === 'new' ? g.count : 0;
    if (open > 0) {
      bump(summary.byCategory, g.categoryId, noCounts, { open });
      bump(summary.byWorker, g.workerId, noCounts, { open });
    }
    if (open > 0 || fresh > 0)
      bump(summary.bySite, g.siteId, noSiteCounts, { open, new: fresh });
  }
  summary.inbox = summary.byStatus.new;
  for (const g of overdue) {
    summary.overdue += g.count;
    bump(summary.byCategory, g.categoryId, noCounts, { overdue: g.count });
    bump(summary.byWorker, g.workerId, noCounts, { overdue: g.count });
    bump(summary.bySite, g.siteId, noSiteCounts, { overdue: g.count });
  }
  return summary;
}
