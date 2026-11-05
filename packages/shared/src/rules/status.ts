import { DomainErrorCode } from '../schemas/errors';
import { ISSUE_STATUSES, type IssueStatus } from '../schemas/enums';

/**
 * Issue status rules (docs/business/04-statuses.md, 06-invariants.md §1, §2, §4, §6).
 * Pure: the API enforces them, the web uses them to show what is missing before a move.
 */

/** The fields of an issue the status rules look at. */
export interface IssueState {
  status: IssueStatus;
  categoryId: string | null;
  description: string | null;
  workerId: string | null;
  /** `YYYY-MM-DD` */
  estimatedDate: string | null;
}

/**
 * What a status needs. `noWorker` is `unassigned`'s rule that it can't be reached while a worker
 * is set (removing the worker is the way back to it).
 */
export type Requirement =
  'category' | 'description' | 'worker' | 'estimatedDate' | 'noWorker';

const SORTED: readonly Requirement[] = ['category', 'description'];
const WITH_WORKER: readonly Requirement[] = [...SORTED, 'worker'];

/** Requirements per status (§4 table). */
export const STATUS_REQUIREMENTS: Readonly<
  Record<IssueStatus, readonly Requirement[]>
> = {
  new: [],
  unassigned: [...SORTED, 'noWorker'],
  assigned: WITH_WORKER,
  sent: WITH_WORKER,
  estimated: [...WITH_WORKER, 'estimatedDate'],
  in_progress: WITH_WORKER,
  solved: WITH_WORKER,
  cancelled: SORTED,
};

/** Statuses that always have a worker (invariant §6.2). */
export const WORKER_STATUSES: readonly IssueStatus[] = [
  'assigned',
  'sent',
  'estimated',
  'in_progress',
  'solved',
];

/** Finished statuses: never overdue, can be reopened. */
export const CLOSED_STATUSES: readonly IssueStatus[] = ['solved', 'cancelled'];

/** Statuses that are neither `new` (unsorted) nor closed. */
export const OPEN_STATUSES: readonly IssueStatus[] = ISSUE_STATUSES.filter(
  (s) => s !== 'new' && !CLOSED_STATUSES.includes(s),
);

/** The timestamp kept the first time an issue reaches a status (§4 "Timestamps"). */
export const FIRST_REACHED_FIELD: Readonly<
  Partial<Record<IssueStatus, 'assignedAt' | 'sentAt' | 'solvedAt'>>
> = { assigned: 'assignedAt', sent: 'sentAt', solved: 'solvedAt' };

/** Position in the lifecycle order (`new` = 0 … `cancelled` = 7). */
export const statusIndex = (status: IssueStatus): number =>
  ISSUE_STATUSES.indexOf(status);

export const isForwardMove = (from: IssueStatus, to: IssueStatus): boolean =>
  statusIndex(to) > statusIndex(from);

export const isClosed = (status: IssueStatus): boolean =>
  CLOSED_STATUSES.includes(status);

export const requiresWorker = (status: IssueStatus): boolean =>
  WORKER_STATUSES.includes(status);

const hasText = (value: string | null): boolean =>
  value !== null && value.trim() !== '';

const holds = (state: IssueState, requirement: Requirement): boolean => {
  switch (requirement) {
    case 'category':
      return state.categoryId !== null;
    case 'description':
      return hasText(state.description);
    case 'worker':
      return state.workerId !== null;
    case 'estimatedDate':
      return state.estimatedDate !== null;
    case 'noWorker':
      return state.workerId === null;
  }
};

/** The requirements of `status` that `state` does not meet, in table order. */
export const missingFor = (
  state: IssueState,
  status: IssueStatus,
): Requirement[] => STATUS_REQUIREMENTS[status].filter((r) => !holds(state, r));

export type RuleResult =
  { ok: true } | { ok: false; code: DomainErrorCode; missing: Requirement[] };

/**
 * May `state` move to `to`? Forward moves may skip steps and any move may go back, except to
 * `new` (§4, invariant §6.6); the target's requirements must hold. A caller that sends an
 * estimated date with the move merges it into `state` first.
 */
export const canMove = (state: IssueState, to: IssueStatus): RuleResult => {
  if (to === 'new') {
    return { ok: false, code: DomainErrorCode.BACK_TO_NEW, missing: [] };
  }
  const missing = missingFor(state, to);
  return missing.length === 0
    ? { ok: true }
    : { ok: false, code: DomainErrorCode.ISSUE_REQUIREMENTS, missing };
};

/**
 * Where reopening a `solved` or `cancelled` issue lands: `assigned` with a worker, `unassigned`
 * without (§4). `null` for an issue that isn't closed.
 */
export const reopenTarget = (
  state: Pick<IssueState, 'status' | 'workerId'>,
): IssueStatus | null => {
  if (!isClosed(state.status)) return null;
  return state.workerId === null ? 'unassigned' : 'assigned';
};
