import type { Prisma } from '@prisma/client';
import {
  CLOSED_STATUSES,
  ISSUE_STATUSES,
  OPEN_STATUSES,
  todayInCairo,
  type IssueStatus,
} from '@muayana/shared';

/** Issue counts per status for one site, worker or category. */
export type StatusTally = Record<IssueStatus, number>;

export const emptyTally = (): StatusTally =>
  Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as StatusTally;

/** A `groupBy([key, status])` row, flattened. */
export interface StatusCountRow {
  key: string;
  status: IssueStatus;
  count: number;
}

/** One tally per key (site, worker…) from grouped rows. */
export function tallyByKey(
  rows: readonly StatusCountRow[],
): Map<string, StatusTally> {
  const tallies = new Map<string, StatusTally>();
  for (const { key, status, count } of rows) {
    const tally = tallies.get(key) ?? emptyTally();
    tally[status] += count;
    tallies.set(key, tally);
  }
  return tallies;
}

/** Sorted but not finished: every status except `new`, `solved`, `cancelled` (shared rules). */
export const openCount = (tally: StatusTally): number =>
  OPEN_STATUSES.reduce((sum, status) => sum + tally[status], 0);

export const totalCount = (tally: StatusTally): number =>
  ISSUE_STATUSES.reduce((sum, status) => sum + tally[status], 0);

/**
 * Overdue issues at `now` (business §4): an estimated date before today in Cairo, not solved
 * or cancelled. The same rule as `isOverdue` in @muayana/shared, as a database filter.
 */
export function overdueIssueWhere(now: Date): Prisma.IssueWhereInput {
  return {
    status: { notIn: [...CLOSED_STATUSES] },
    estimatedDate: { lt: new Date(`${todayInCairo(now)}T00:00:00.000Z`) },
  };
}
