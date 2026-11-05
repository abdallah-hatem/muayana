import type { Issue, IssueState, Photo, PhotoKind } from '@muayana/shared';

/** The fields the shared status rules read (`canMove`, `applyPatch`, …) from a contract Issue. */
export const toIssueState = (
  issue: Pick<
    Issue,
    'status' | 'category' | 'description' | 'worker' | 'estimatedDate'
  >,
): IssueState => ({
  status: issue.status,
  categoryId: issue.category?.id ?? null,
  description: issue.description,
  workerId: issue.worker?.id ?? null,
  estimatedDate: issue.estimatedDate,
});

/** The photos of one kind, in their order (cover first). */
export const photosOf = (photos: readonly Photo[], kind: PhotoKind): Photo[] =>
  photos
    .filter((p) => p.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
