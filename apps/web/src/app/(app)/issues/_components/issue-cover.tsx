import type { Issue } from '@muayana/shared';
import { FillPhoto, PhotoMissingIcon } from '@/components/photo';
import { cn } from '@/lib/utils';

/** The first before-photo: what the engineer recognises an issue by. */
export function coverPhoto(issue: Pick<Issue, 'photos'>) {
  return [...issue.photos]
    .filter((p) => p.kind === 'before')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

/** A square crop of the cover photo, or a quiet placeholder when there is none. */
export function IssueCover({
  issue,
  className,
}: {
  issue: Pick<Issue, 'photos'>;
  className?: string;
}) {
  const photo = coverPhoto(issue);
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-md bg-muted',
        className,
      )}
    >
      {photo ? (
        <FillPhoto src={photo.url} alt="" sizes="96px" />
      ) : (
        <PhotoMissingIcon />
      )}
    </div>
  );
}
