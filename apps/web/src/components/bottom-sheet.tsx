'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * True while `el` has content hidden below its bottom edge — the cue that the sheet body scrolls.
 * Re-checked on scroll and whenever the body or its content changes size.
 */
function useMoreBelow(el: HTMLElement | null): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!el) return;
    const check = () =>
      setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    observer?.observe(el);
    for (const child of Array.from(el.children)) observer?.observe(child);
    const mutations = new MutationObserver(check);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', check);
      observer?.disconnect();
      mutations.disconnect();
    };
  }, [el]);
  return more;
}

/**
 * A sheet from the bottom edge (thumb reach): fixed title and actions, only the body scrolls, never
 * taller than the screen. Centred card width from md up.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  keepKeyboardDown = false,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
  /**
   * Opens with focus on the sheet itself, not its first field, so a phone's keyboard stays down
   * until a field is tapped (the capture sheet).
   */
  keepKeyboardDown?: boolean;
  testId?: string;
}) {
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const moreBelow = useMoreBelow(body);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid={testId}
        onOpenAutoFocus={
          keepKeyboardDown
            ? (event) => {
                event.preventDefault();
                (event.currentTarget as HTMLElement | null)?.focus();
              }
            : undefined
        }
        className={cn(
          'mx-auto max-h-[calc(100dvh-2rem)] w-full gap-0 rounded-t-xl border-t-4 border-primary pb-safe md:max-w-lg',
          className,
        )}
      >
        <SheetHeader className="pe-12">
          <SheetTitle className="type-heading">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="type-body text-muted-foreground">
              {description}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        {children && (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={setBody}
              className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-2"
            >
              {children}
            </div>
            {/* Shown only while more of the body sits below the fold. */}
            {moreBelow && (
              <div
                aria-hidden
                data-testid="sheet-more-below"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent"
              />
            )}
          </div>
        )}
        <SheetFooter className="mt-0 flex-row gap-2 [&>*]:flex-1">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
