'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** The quiet "no picture" mark: a photo that is missing, or one that failed to load or decode. */
export function PhotoMissingIcon({ className }: { className?: string }) {
  return (
    <ImageOff
      className={cn(
        'absolute inset-0 m-auto size-6 text-muted-foreground',
        className,
      )}
      aria-hidden
    />
  );
}

/**
 * A stored photo filling its (relative, `bg-muted`) box. A URL that fails (404, unreadable bytes)
 * shows the "no picture" mark instead of the browser's broken-image icon.
 */
export function FillPhoto({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src)
    return (
      <span role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <PhotoMissingIcon />
      </span>
    );
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      priority={priority}
      className={cn('object-cover', className)}
      onError={() => setFailedSrc(src)}
    />
  );
}

/**
 * A photo from the phone itself (an object URL). One that fails to decode becomes a muted box of
 * the same size and shape with the "no picture" mark, never a broken-image icon.
 */
export const LocalPhoto = forwardRef<
  HTMLImageElement,
  React.ComponentProps<'img'>
>(function LocalPhoto({ className, alt, onError, ...props }, ref) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        data-testid="photo-failed"
        className={cn('relative block bg-muted', className)}
      >
        <PhotoMissingIcon />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise
    <img
      ref={ref}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...props}
    />
  );
});
