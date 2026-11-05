import {
  applyPatch,
  missingFor,
  type DomainErrorCode,
  type Issue,
  type Requirement,
  type Worker,
} from '@muayana/shared';
import { toIssueState } from '@/lib/issue-state';

export interface SortForm {
  categoryId: string | null;
  description: string;
  worker: Worker | null;
}

export type SortCheck =
  { ok: true } | { ok: false; missing: Requirement[]; code?: DomainErrorCode };

/**
 * Would saving this sort take the issue out of `new` (business §5.3)? Decided by the shared rules:
 * `applyPatch` applies the automatic moves, and an issue still `new` afterwards misses what
 * `unassigned` requires (category, description — invariant §6.1).
 */
export function checkSort(issue: Issue, form: SortForm): SortCheck {
  const result = applyPatch(
    toIssueState(issue),
    {
      categoryId: form.categoryId ?? undefined,
      description: form.description,
      workerId: form.worker?.id,
    },
    {
      worker: form.worker
        ? {
            categoryIds: form.worker.categories.map((c) => c.id),
            active: form.worker.active,
          }
        : null,
    },
  );
  if (!result.ok)
    return { ok: false, missing: result.missing, code: result.code };
  if (result.state.status === 'new')
    return {
      ok: false,
      missing: missingFor(result.state, 'unassigned').filter(
        (r) => r !== 'noWorker',
      ),
    };
  return { ok: true };
}

/** A worker picked before the category changed stays only if he covers the new one (§6.3). */
export const keepsWorker = (worker: Worker | null, categoryId: string) =>
  worker !== null && worker.categories.some((c) => c.id === categoryId);
