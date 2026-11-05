import { DomainErrorCode } from '../schemas/errors';
import type { IssueStatus } from '../schemas/enums';
import {
  type IssueState,
  type Requirement,
  missingFor,
  requiresWorker,
} from './status';

/**
 * The rule-bearing fields of `PATCH /issues/:id` (location and priority carry no rules). `null`
 * clears a field; an absent key leaves it alone. `categoryId: null` and `description: ''` are
 * accepted here so the rule — not the transport — refuses them outside `new`.
 */
export interface IssuePatch {
  description?: string | null;
  categoryId?: string | null;
  workerId?: string | null;
  estimatedDate?: string | null;
}

/** What the caller knows about the worker the issue will have after the patch. */
export interface PatchWorkerFacts {
  categoryIds: readonly string[];
  active: boolean;
}

export interface PatchContext {
  /**
   * The worker the issue ends up with: the chosen one when `patch.workerId` is an id, otherwise
   * the current one. Needed whenever a worker is chosen or the category changes under a worker;
   * `null` when the issue has no worker after the patch.
   */
  worker: PatchWorkerFacts | null;
}

export interface StatusMove {
  from: IssueStatus;
  to: IssueStatus;
}

export type PatchResult =
  | {
      ok: true;
      state: IssueState;
      /** `null` when the status did not change (no status-change record is written). */
      statusChange: StatusMove | null;
      /** The category change removed a worker who doesn't cover it (§3, invariant §6.3). */
      workerRemoved: boolean;
    }
  | { ok: false; code: DomainErrorCode; missing: Requirement[] };

const refuse = (
  code: DomainErrorCode,
  missing: Requirement[] = [],
): PatchResult => ({ ok: false, code, missing });

const blankToNull = (value: string | null): string | null =>
  value === null || value.trim() === '' ? null : value;

const needWorker = (ctx: PatchContext): PatchWorkerFacts => {
  if (ctx.worker === null) {
    throw new Error('applyPatch: ctx.worker is required for this patch');
  }
  return ctx.worker;
};

/**
 * Applies a patch and the automatic moves of §4 / §5.3:
 * - category + description set on `new` → `unassigned`;
 * - a worker chosen on `unassigned` → `assigned` (a different worker later keeps the status);
 * - the worker removed (or dropped by a category he lacks) on a worker status → `unassigned`;
 * - an estimated date set on `assigned` / `sent` → `estimated`.
 * Refuses clearing the category or description outside `new` and the date on `estimated`.
 */
export const applyPatch = (
  state: IssueState,
  patch: IssuePatch,
  ctx: PatchContext,
): PatchResult => {
  const from = state.status;

  if (from !== 'new') {
    if (patch.categoryId === null) {
      return refuse(DomainErrorCode.ISSUE_REQUIREMENTS, ['category']);
    }
    if (
      patch.description !== undefined &&
      blankToNull(patch.description) === null
    ) {
      return refuse(DomainErrorCode.ISSUE_REQUIREMENTS, ['description']);
    }
  }
  if (from === 'estimated' && patch.estimatedDate === null) {
    return refuse(DomainErrorCode.ISSUE_REQUIREMENTS, ['estimatedDate']);
  }

  const next: IssueState = { ...state };
  if (patch.description !== undefined)
    next.description = blankToNull(patch.description);
  if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
  if (patch.estimatedDate !== undefined)
    next.estimatedDate = patch.estimatedDate;

  const workerChosen =
    typeof patch.workerId === 'string' && patch.workerId !== state.workerId;
  const categoryChanged =
    patch.categoryId !== undefined && patch.categoryId !== state.categoryId;
  let workerRemoved = false;

  if (workerChosen) {
    const worker = needWorker(ctx);
    if (!worker.active) return refuse(DomainErrorCode.INACTIVE_WORKER);
    if (next.categoryId === null) {
      return refuse(DomainErrorCode.ISSUE_REQUIREMENTS, ['category']);
    }
    if (!worker.categoryIds.includes(next.categoryId)) {
      return refuse(DomainErrorCode.WORKER_LACKS_CATEGORY);
    }
    next.workerId = patch.workerId ?? null;
  } else if (patch.workerId === null) {
    next.workerId = null;
  } else if (
    categoryChanged &&
    next.workerId !== null &&
    next.categoryId !== null
  ) {
    if (!needWorker(ctx).categoryIds.includes(next.categoryId)) {
      next.workerId = null;
      workerRemoved = true;
    }
  }

  let to: IssueStatus = from;
  const sorted = next.categoryId !== null && next.description !== null;
  if (to === 'new' && sorted) to = 'unassigned';
  if (next.workerId === null && requiresWorker(to)) to = 'unassigned';
  if (to === 'unassigned' && next.workerId !== null) to = 'assigned';
  if (patch.estimatedDate != null && (to === 'assigned' || to === 'sent')) {
    to = 'estimated';
  }

  if (to === 'new' && next.workerId !== null) {
    // A worker chosen before the issue is sorted: it can't be assigned yet.
    return refuse(
      DomainErrorCode.ISSUE_REQUIREMENTS,
      missingFor(next, 'assigned'),
    );
  }
  const missing = missingFor(next, to);
  if (missing.length > 0) {
    return refuse(DomainErrorCode.ISSUE_REQUIREMENTS, missing);
  }

  next.status = to;
  return {
    ok: true,
    state: next,
    statusChange: to === from ? null : { from, to },
    workerRemoved,
  };
};
