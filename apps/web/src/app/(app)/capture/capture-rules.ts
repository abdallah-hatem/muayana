import {
  planCapture,
  type DomainErrorCode,
  type Requirement,
} from '@muayana/shared';
import type { CaptureWorker } from '@/lib/capture-prefs';

export interface CaptureForm {
  categoryId: string | null;
  description: string;
  worker: CaptureWorker | null;
}

export type CaptureCheck =
  { ok: true } | { ok: false; missing: Requirement[]; code: DomainErrorCode };

/**
 * May the capture sheet be saved as filled in (business §5.1)? The shared planCapture decides —
 * the same rule the API applies at upload: a contractor needs the trade and a description.
 */
export function checkCapture(form: CaptureForm): CaptureCheck {
  const result = planCapture(
    {
      categoryId: form.categoryId,
      description: form.description.trim(),
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
  return result.ok
    ? { ok: true }
    : { ok: false, missing: result.missing, code: result.code };
}
