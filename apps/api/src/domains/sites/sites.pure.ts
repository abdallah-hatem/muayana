import type { Site } from '@muayana/shared';
import {
  emptyTally,
  openCount,
  totalCount,
  type StatusTally,
} from '../../common/utils/issue-counts.util';
import type { SiteRow } from './repositories/sites.repository';

/** A site row plus its issue counts, as the contract's `Site`. */
export function toSite(
  row: SiteRow,
  tally: StatusTally = emptyTally(),
  overdue = 0,
): Site {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    counts: {
      open: openCount(tally),
      new: tally.new,
      overdue,
      total: totalCount(tally),
    },
  };
}

/**
 * Does saving this site need the "name unique among non-archived sites" check (business §3)?
 * Only when the site ends up non-archived and either its name changes or it is being unarchived.
 */
export function needsNameCheck(
  current: { nameKey: string; archived: boolean },
  next: { nameKey: string; archived: boolean },
): boolean {
  if (next.archived) return false;
  return current.archived || current.nameKey !== next.nameKey;
}
