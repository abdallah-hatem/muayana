import { PHOTOS_PER_KIND_MAX, type Issue } from '@muayana/shared';
import { photosOf } from '@/lib/issue-state';

export type MergeCheck =
  | { ok: true; target: Issue; source: Issue }
  | { ok: false; reason: 'count' | 'notNew' | 'tooManyPhotos' };

/**
 * May these selected issues be merged (business §5.3)? Exactly two, both `new`, and their
 * before-photos together within the 10-photo limit. The older capture is kept (the target); the
 * other's photos move into it and it is removed.
 */
export function mergeCheck(selected: readonly Issue[]): MergeCheck {
  if (selected.length !== 2) return { ok: false, reason: 'count' };
  if (selected.some((i) => i.status !== 'new'))
    return { ok: false, reason: 'notNew' };
  const photos = selected.reduce(
    (sum, i) => sum + photosOf(i.photos, 'before').length,
    0,
  );
  if (photos > PHOTOS_PER_KIND_MAX)
    return { ok: false, reason: 'tooManyPhotos' };
  const [target, source] = [...selected].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt),
  );
  return { ok: true, target, source };
}
