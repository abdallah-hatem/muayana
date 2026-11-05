import type { IssueStatus } from '../schemas/enums';
import { isClosed } from './status';

/** The business runs on Cairo time (§4 overdue, §7 export dates). */
export const BUSINESS_TIME_ZONE = 'Africa/Cairo';

const cairoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const cairoParts = (instant: Date): Record<string, string> =>
  Object.fromEntries(
    cairoFormatter.formatToParts(instant).map((p) => [p.type, p.value]),
  );

const toDate = (instant: Date | string): Date =>
  instant instanceof Date ? instant : new Date(instant);

/** The Cairo calendar date of `now`, `YYYY-MM-DD`. */
export const todayInCairo = (now: Date): string => {
  const p = cairoParts(now);
  return `${p.year}-${p.month}-${p.day}`;
};

/** `YYYY-MM-DD HH:mm` in Cairo time (§7). Empty string for a missing or invalid instant. */
export const formatCairoDateTime = (
  instant: Date | string | null | undefined,
): string => {
  if (instant === null || instant === undefined) return '';
  const date = toDate(instant);
  if (Number.isNaN(date.getTime())) return '';
  const p = cairoParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

/**
 * Overdue (§4): an estimated date before today in Cairo, on an issue that isn't `solved` or
 * `cancelled`. A flag computed from the date, never stored.
 */
export const isOverdue = (
  issue: { status: IssueStatus; estimatedDate: string | null },
  now: Date,
): boolean =>
  issue.estimatedDate !== null &&
  !isClosed(issue.status) &&
  issue.estimatedDate < todayInCairo(now);
