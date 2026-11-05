'use client';

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
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
          <div className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-2">
            {children}
          </div>
        )}
        <SheetFooter className="mt-0 flex-row gap-2 [&>*]:flex-1">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
