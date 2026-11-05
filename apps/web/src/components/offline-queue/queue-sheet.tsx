'use client';

import { CloudOff, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useState } from 'react';
import { LocalPhoto } from '@/components/photo';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  discardItem,
  retryItem,
  useQueueItems,
  type QueueItem,
} from '@/lib/offline-queue';
import { useOnline } from '@/lib/use-online';
import { cn } from '@/lib/utils';

const QueueSheetContext = createContext<() => void>(() => undefined);

/** Opens the upload queue sheet (from the top bar chip, the capture screen, …). */
export const useOpenQueueSheet = () => useContext(QueueSheetContext);

/** Holds the queue sheet once for the whole signed-in app. */
export function QueueSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <QueueSheetContext.Provider value={() => setOpen(true)}>
      {children}
      <QueueSheet open={open} onOpenChange={setOpen} />
    </QueueSheetContext.Provider>
  );
}

/** Everything waiting on the phone, oldest first, each with retry and discard. */
export function QueueSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('capture.queue');
  const items = useQueueItems();
  const online = useOnline();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[calc(100dvh-2rem)]">
        <DrawerHeader>
          <DrawerTitle className="type-heading">{t('title')}</DrawerTitle>
          <DrawerDescription className="type-small">
            {t('description')}
          </DrawerDescription>
        </DrawerHeader>
        {!online && (
          <p className="mx-4 mb-2 flex items-center gap-2 rounded-md border-2 border-foreground/80 bg-card px-3 py-2 type-small font-bold">
            <span
              className="h-4 w-6 shrink-0 rounded-sm hazard-stripe"
              aria-hidden
            />
            {t('offline')}
          </p>
        )}
        <ul
          data-testid="queue-list"
          className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-6"
        >
          {items?.length === 0 && (
            <li className="py-8 text-center type-body text-muted-foreground">
              {t('empty')}
            </li>
          )}
          {items?.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

/** A thumbnail straight from the queued bytes. */
function QueueThumb({ item, label }: { item: QueueItem; label: string }) {
  const { bytes, type } = item.photo;
  // The object URL lives exactly as long as the <img>: made on attach, revoked on detach.
  const attach = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [bytes, type],
  );
  return (
    // A photo that fails to decode becomes a muted square with the "no picture" mark.
    <LocalPhoto
      ref={attach}
      alt={label}
      className="size-16 shrink-0 overflow-hidden rounded-md bg-muted object-cover text-transparent"
    />
  );
}

/** The translated reason of a failed upload. */
export function useUploadErrorText(): (code: string | null) => string {
  const t = useTranslations('capture.errors');
  return (code) => (code && t.has(code) ? t(code) : t('generic'));
}

function QueueRow({ item }: { item: QueueItem }) {
  const t = useTranslations('capture.queue');
  const format = useFormatter();
  const errorText = useUploadErrorText();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const time = format.dateTime(new Date(item.capturedAt), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const failed = item.status === 'failed';

  const retry = async () => {
    setBusy(true);
    try {
      await retryItem(item.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      data-testid="queue-item"
      data-status={item.status}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 bg-card p-3',
        failed ? 'border-destructive' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <QueueThumb item={item} label={t('thumbnail', { time })} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="type-small font-bold">{t(`kind.${item.kind}`)}</p>
          <p className="type-micro text-muted-foreground">
            <time dateTime={item.capturedAt}>{time}</time>
            {item.location && <> · {item.location}</>}
          </p>
          <p
            className={cn(
              'flex items-center gap-1 type-micro',
              failed ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {failed ? t('failed') : t('pending')}
            {item.attempts > 0 && (
              <> · {t('tries', { count: item.attempts })}</>
            )}
          </p>
          {item.lastError && (
            <p className="type-small break-words text-destructive">
              {errorText(item.lastError)}
            </p>
          )}
        </div>
      </div>
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="type-small font-bold">{t('discardConfirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('keep')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void discardItem(item.id)}
            >
              <Trash2 aria-hidden />
              {t('discardYes')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void retry()}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RotateCw aria-hidden />
            )}
            {t('retry')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            {t('discard')}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * "N waiting to upload": the queue badge. Hidden when nothing waits; turns red when an item has
 * failed. Opens the queue sheet. `compact` (the top bar) shows only the icon and the count on a
 * phone, the full words from sm up; its accessible name is always the full sentence.
 */
export function QueueChip({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('capture.queue');
  const items = useQueueItems();
  const open = useOpenQueueSheet();
  const count = items?.length ?? 0;
  if (count === 0) return null;
  const failed = items!.some((i) => i.status === 'failed');
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`${t('chip', { count })} · ${t('open')}`}
      data-testid="queue-chip"
      data-failed={failed || undefined}
      className={cn(
        'inline-flex h-11 shrink-0 press cursor-pointer items-center gap-1.5 rounded-sm px-2.5 type-micro font-bold whitespace-nowrap',
        failed
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-status-new text-status-new-foreground',
        className,
      )}
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      {compact ? (
        <>
          <span className="type-stencil sm:hidden">{count}</span>
          <span className="hidden sm:inline">{t('chip', { count })}</span>
        </>
      ) : (
        t('chip', { count })
      )}
    </button>
  );
}
