import { ConflictException } from '@nestjs/common';
import {
  DomainErrorCode,
  FIRST_REACHED_FIELD,
  canMove,
  isClosed,
  isOverdue,
  reopenTarget,
  type Issue,
  type IssueState,
  type IssueStatus,
  type Requirement,
  type StatusChange,
} from '@muayana/shared';
import { dbToDateOnly } from '../../common/utils/issue-filter.util';
import type {
  IssueRow,
  IssueStateRow,
  StatusChangeRow,
} from './repositories/issue.repository';

/*
 * Pure pieces of the issues domain: response mapping and the glue between stored rows and the
 * shared rules (@muayana/shared rules/*). No rule is re-stated here — canMove, applyPatch,
 * reopenTarget and isOverdue decide; this file only feeds them and reads their answers.
 */

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? iso(d) : null);

/** A stored issue as the contract's `Issue`. `overdue` is computed, never stored (§4). */
export function toIssue(row: IssueRow, now: Date): Issue {
  const estimatedDate = dbToDateOnly(row.estimatedDate);
  return {
    id: row.id,
    siteId: row.siteId,
    site: row.site,
    number: row.number,
    status: row.status,
    priority: row.priority,
    description: row.description,
    location: row.location,
    category: row.category,
    worker: row.worker,
    formerWorkerName: row.formerWorkerName,
    estimatedDate,
    capturedAt: iso(row.capturedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    assignedAt: isoOrNull(row.assignedAt),
    sentAt: isoOrNull(row.sentAt),
    solvedAt: isoOrNull(row.solvedAt),
    overdue: isOverdue({ status: row.status, estimatedDate }, now),
    photos: row.photos.map((p) => ({ ...p, createdAt: iso(p.createdAt) })),
  };
}

export const toStatusChange = (row: StatusChangeRow): StatusChange => ({
  ...row,
  createdAt: iso(row.createdAt),
});

/** The shape the shared rules read. */
export const toState = (row: IssueStateRow): IssueState => ({
  status: row.status,
  categoryId: row.categoryId,
  description: row.description,
  workerId: row.workerId,
  formerWorkerName: row.formerWorkerName,
  estimatedDate: dbToDateOnly(row.estimatedDate),
});

/**
 * The first-reached timestamp to set when an issue arrives at `to` (§4: kept the first time
 * only). Empty when `to` has none or it is already set.
 */
export function firstReachedStamp(
  row: Pick<IssueStateRow, 'assignedAt' | 'sentAt' | 'solvedAt'>,
  to: IssueStatus,
  now: Date,
): Partial<Record<'assignedAt' | 'sentAt' | 'solvedAt', Date>> {
  const field = FIRST_REACHED_FIELD[to];
  return field && row[field] === null ? { [field]: now } : {};
}

/**
 * The status a requested move lands on. Reopening a closed issue (asking for `assigned` or
 * `unassigned` from `solved`/`cancelled`) lands where reopenTarget says: `assigned` with a
 * worker, `unassigned` without (§4).
 */
export function resolveTarget(
  state: IssueState,
  requested: IssueStatus,
): IssueStatus {
  if (
    isClosed(state.status) &&
    (requested === 'assigned' || requested === 'unassigned')
  ) {
    return reopenTarget(state) ?? requested;
  }
  return requested;
}

export type MovePlan =
  | { ok: true; state: IssueState; moved: boolean }
  | { ok: false; code: DomainErrorCode; missing: Requirement[] };

/**
 * A status move (POST /issues/:id/status, bulk status): the estimated date sent with the move
 * is merged first, then canMove decides. Asking for the current status is not a move.
 */
export function planMove(
  state: IssueState,
  requested: IssueStatus,
  estimatedDate?: string,
): MovePlan {
  const to = resolveTarget(state, requested);
  const next: IssueState = {
    ...state,
    estimatedDate: estimatedDate ?? state.estimatedDate,
  };
  if (to === state.status) return { ok: true, state: next, moved: false };
  const rule = canMove(next, to);
  if (!rule.ok) return rule;
  return { ok: true, state: { ...next, status: to }, moved: true };
}

const RULE_MESSAGES: Record<DomainErrorCode, string> = {
  ISSUE_REQUIREMENTS: 'The issue does not meet the requirements of that status',
  BACK_TO_NEW: 'An issue cannot move back to new',
  LAST_PHOTO: 'The last before-photo cannot be deleted',
  PHOTO_LIMIT: 'An issue holds at most 10 photos of each kind',
  IN_USE: 'The record is in use',
  DUPLICATE: 'A record with that value already exists',
  WORKER_LACKS_CATEGORY: "The worker does not have the issue's category",
  INACTIVE_WORKER: 'The worker is deactivated',
  INACTIVE_CATEGORY: 'The category is deactivated',
  ARCHIVED_SITE: 'The site is archived',
  NOT_NEW: 'Only issues in new can do that',
  WORKER_HAS_ISSUES:
    'This worker has issues: choose to keep them or delete them too',
};

/** A 409 carrying a domain code (and, for a requirements refusal, what is missing). */
export function ruleConflict(
  code: DomainErrorCode,
  data?: unknown,
): ConflictException {
  return new ConflictException({
    message: RULE_MESSAGES[code],
    error: code,
    ...(data === undefined ? {} : { data }),
  });
}
