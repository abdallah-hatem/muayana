import {
  OPEN_STATUSES,
  UuidSchema,
  type Dashboard,
  type IssueStatus,
} from '@muayana/shared';
import { issuesHref } from '@/lib/issue-filter-url';
import { ROUTES } from '@/lib/routes';

/**
 * Where each dashboard number leads (§5.9): the issues list filtered to exactly what the number
 * counts, inside the dashboard's site when one is chosen. Built with the same URL writer the
 * list reads, so a number and the list it opens can't disagree.
 */

/** "Open" = sorted and not finished: unassigned … in progress. */
export const OPEN_FILTER = { status: [...OPEN_STATUSES] as IssueStatus[] };

export const INBOX_HREF = ROUTES.inbox;

export const dashboardLinks = (siteId?: string) => ({
  open: issuesHref({ siteId, ...OPEN_FILTER }),
  overdue: issuesHref({ siteId, overdue: true }),
  status: (status: IssueStatus) => issuesHref({ siteId, status: [status] }),
  category: (categoryId: string, overdue = false) =>
    issuesHref(
      overdue
        ? { siteId, categoryId, overdue: true }
        : { siteId, categoryId, ...OPEN_FILTER },
    ),
  worker: (workerId: string, overdue = false) =>
    issuesHref(
      overdue
        ? { siteId, workerId, overdue: true }
        : { siteId, workerId, ...OPEN_FILTER },
    ),
  site: (id: string, overdue = false) =>
    issuesHref(
      overdue ? { siteId: id, overdue: true } : { siteId: id, ...OPEN_FILTER },
    ),
});

/** The open count: the open statuses summed. */
export const openCount = (byStatus: Dashboard['byStatus']): number =>
  OPEN_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);

/** The SiteSwitcher remembers the last site here (T8). */
export const LAST_SITE_KEY = 'muayana:lastSiteId';

/** The last site chosen in the switcher, if it left a valid id. */
export function readLastSiteId(): string | undefined {
  try {
    const value = window.localStorage.getItem(LAST_SITE_KEY);
    return value && UuidSchema.safeParse(value).success ? value : undefined;
  } catch {
    return undefined;
  }
}
