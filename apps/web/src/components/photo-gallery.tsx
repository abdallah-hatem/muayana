'use client';

import { useState } from 'react';
import type { Photo } from '@muayana/shared';
import { cn } from '@/lib/utils';
import { FillPhoto } from './photo';

/**
 * Photos edge to edge, swiped sideways (native scroll-snap: momentum, RTL and keyboard come for
 * free), with a position counter and dots. Photo first: this is where the decision is made.
 */
export function PhotoGallery({
  photos,
  alt,
  className,
  overlay,
  empty,
}: {
  photos: readonly Photo[];
  /** Alt text for every photo, e.g. "Issue #38, photo". The position is appended. */
  alt: string;
  className?: string;
  /** Badges drawn over the photo (status, number). */
  overlay?: React.ReactNode;
  /** Shown when there is no photo of this kind. */
  empty?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.clientWidth === 0) return;
    // scrollLeft is negative in RTL: the distance is what matters.
    setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }

  return (
    <div
      className={cn(
        'relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted',
        className,
      )}
    >
      {photos.length === 0 ? (
        <div className="flex size-full items-center justify-center p-4 text-center type-small text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div
          onScroll={onScroll}
          className="flex size-full snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative size-full shrink-0 snap-center"
            >
              <FillPhoto
                src={photo.url}
                alt={`${alt} ${index + 1}/${photos.length}`}
                sizes="(min-width: 768px) 640px, 100vw"
                priority={index === 0}
              />
            </div>
          ))}
        </div>
      )}
      {overlay}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {photos.map((photo, index) => (
            <span
              key={photo.id}
              aria-hidden
              className={cn(
                'size-2 rounded-full bg-background/70 shadow-card transition-transform',
                index === active && 'scale-125 bg-primary',
              )}
            />
          ))}
          <span className="ms-2 rounded-sm bg-foreground/80 px-1.5 py-0.5 type-micro text-background">
            <span dir="ltr" className="type-stencil">
              {Math.min(active + 1, photos.length)}/{photos.length}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
