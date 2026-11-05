import type { Issue } from '@muayana/shared';
import { ImageOff } from 'lucide-react';
import Image from 'next/image';
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
        <Image
          src={photo.url}
          alt=""
          fill
          sizes="96px"
          unoptimized
          className="object-cover"
        />
      ) : (
        <ImageOff
          className="absolute inset-0 m-auto size-6 text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  );
}
