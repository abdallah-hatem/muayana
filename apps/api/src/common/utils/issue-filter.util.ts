import {
  BUSINESS_TIME_ZONE,
  CLOSED_STATUSES,
  todayInCairo,
  type IssueSort,
  type ParsedIssueFilter,
} from '@muayana/shared';
import type { Prisma } from '@prisma/client';

/*
 * The one translation of the contract's IssueFilter into a Prisma query (business §5.8). The
 * issues list uses it, and so do the CSV exports and the dashboard: "the current filter is
 * exactly what export uses". Pure: the caller passes "now".
 */

const DAY_MS = 86_400_000;

/** Minutes Cairo is ahead of UTC at `instant` (+120 in winter, +180 in summer time). */
function cairoOffsetMinutes(instant: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

/** The instant a Cairo calendar day (`YYYY-MM-DD`) starts. */
export function cairoDayStart(date: string): Date {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const offset = cairoOffsetMinutes(new Date(utcMidnight));
  return new Date(utcMidnight - offset * 60_000);
}

/** A `YYYY-MM-DD` as the Date Prisma stores in a `@db.Date` column (UTC midnight). */
export const dateOnlyToDb = (date: string): Date =>
  new Date(`${date}T00:00:00Z`);

/** A `@db.Date` value back to `YYYY-MM-DD`. */
export const dbToDateOnly = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10);

/** `from`/`to` Cairo dates → an inclusive instant range (to = before the next day starts). */
function dayRange(
  from: string | undefined,
  to: string | undefined,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = cairoDayStart(from);
  if (to) {
    const next = new Date(dateOnlyToDb(to).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
    range.lt = cairoDayStart(next);
  }
  return range;
}

/** Overdue (business §4, `isOverdue`) as a query: an estimate before today, not closed. */
export function overdueWhere(now: Date): Prisma.IssueWhereInput {
  return {
    estimatedDate: { lt: dateOnlyToDb(todayInCairo(now)) },
    status: { notIn: [...CLOSED_STATUSES] },
  };
}

/** The complement of overdueWhere, spelled out so a NULL date counts as "not overdue". */
export function notOverdueWhere(now: Date): Prisma.IssueWhereInput {
  return {
    OR: [
      { estimatedDate: null },
      { estimatedDate: { gte: dateOnlyToDb(todayInCairo(now)) } },
      { status: { in: [...CLOSED_STATUSES] } },
    ],
  };
}

/** `q` matches the number (`12` or `#12`), the description or the location. */
function textWhere(q: string): Prisma.IssueWhereInput[] {
  const or: Prisma.IssueWhereInput[] = [
    { description: { contains: q, mode: 'insensitive' } },
    { location: { contains: q, mode: 'insensitive' } },
  ];
  const digits = /^#?\s*(\d{1,9})$/.exec(q);
  if (digits) or.push({ number: Number(digits[1]) });
  return or;
}

export type IssueWhereFilter = Omit<ParsedIssueFilter, 'sort'> & {
  sort?: IssueSort;
};

/** The where-clause for an IssueFilter. Every filter is ANDed; date bounds are inclusive. */
export function buildIssueWhere(
  filter: IssueWhereFilter,
  now: Date,
): Prisma.IssueWhereInput {
  const and: Prisma.IssueWhereInput[] = [];
  if (filter.siteId) and.push({ siteId: filter.siteId });
  if (filter.categoryId) and.push({ categoryId: filter.categoryId });
  if (filter.workerId) and.push({ workerId: filter.workerId });
  if (filter.status?.length) and.push({ status: { in: filter.status } });
  if (filter.priority?.length) and.push({ priority: { in: filter.priority } });
  if (filter.overdue === true) and.push(overdueWhere(now));
  if (filter.overdue === false) and.push(notOverdueWhere(now));

  const captured = dayRange(filter.capturedFrom, filter.capturedTo);
  if (captured) and.push({ capturedAt: captured });
  const solved = dayRange(filter.solvedFrom, filter.solvedTo);
  if (solved) and.push({ solvedAt: solved });

  const q = filter.q?.trim();
  if (q) and.push({ OR: textWhere(q) });

  return and.length ? { AND: and } : {};
}

/**
 * Sort orders (business §5.8). Every order ends on the id so pages never overlap.
 * - newest / oldest: by capture time;
 * - priority: urgent first (the enum's declared order), then newest;
 * - estimate: earliest estimated date first, issues without one last, then newest.
 */
export function issueOrderBy(
  sort: IssueSort = 'newest',
): Prisma.IssueOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ capturedAt: 'asc' }, { number: 'asc' }, { id: 'asc' }];
    case 'priority':
      return [{ priority: 'desc' }, { capturedAt: 'desc' }, { id: 'asc' }];
    case 'estimate':
      return [
        { estimatedDate: { sort: 'asc', nulls: 'last' } },
        { capturedAt: 'desc' },
        { id: 'asc' },
      ];
    case 'newest':
      return [{ capturedAt: 'desc' }, { number: 'desc' }, { id: 'asc' }];
  }
}
