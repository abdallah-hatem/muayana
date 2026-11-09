'use client';

import { ImageDown, Loader2, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { ApiResult } from '@/lib/api-result';
import type { ShareMore, ShareStep } from '@/lib/whatsapp-share';
import { useApiErrorText } from '@/components/use-api-error-text';
import type { PhotoPreparation } from './use-prepared-photos';

/**
 * The send gesture shared by one issue and a worker's batch (business §5.5): hand the message to
 * WhatsApp — in several shares when the photos don't fit in one, each on its own tap — then, only
 * if the engineer didn't back out, ask "Mark as sent?". Only his yes sends the status request,
 * exactly once however fast he taps. With `prepare`, the photos are downloaded first, on his tap
 * ("Prepare photos", n of m, cancellable); only once they're ready does the button share — straight
 * from that tap, never after waiting on a download, so the share keeps its user activation.
 */
export function SendFlow<T>({
  label,
  disabledReason,
  share,
  askToMarkSent,
  markSent,
  onMarked,
  confirmBody,
  hint,
  onDeclined,
  prepare,
}: {
  label: string;
  /** A note under the button while it can be used (e.g. which batch this is). */
  hint?: string | null;
  /** He answered "Not yet" after sending. */
  onDeclined?: () => void;
  /** Why sending isn't possible now; the button is disabled and this shows under it. */
  disabledReason?: string | null;
  share: () => Promise<ShareStep>;
  /** False when the status shouldn't change after sending (already sent or further). */
  askToMarkSent: boolean;
  markSent: () => Promise<ApiResult<T>>;
  onMarked: (data: T) => void;
  confirmBody?: string;
  /** Photos to download on demand before the share; absent or `ready` → the button shares. */
  prepare?: PhotoPreparation;
}) {
  const t = useTranslations('send');
  const errorText = useApiErrorText();
  const [sharing, setSharing] = useState(false);
  // The shares still to go when the photos didn't fit in one.
  const [more, setMore] = useState<ShareMore | null>(null);
  const [asking, setAsking] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const reasonId = useId();

  async function start() {
    if (sharing) return;
    setSharing(true);
    const step = await (more ? more.next() : share());
    setSharing(false);
    if (typeof step === 'object') {
      setMore(step);
      return;
    }
    setMore(null);
    if (step === 'cancelled' || !askToMarkSent) return;
    setError(null);
    setAsking(true);
  }

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setMarking(true);
    setError(null);
    const res = await markSent();
    inFlight.current = false;
    setMarking(false);
    if (!res.success) {
      setError(errorText(res));
      return;
    }
    setAsking(false);
    onMarked(res.data);
  }

  const preparing = prepare && prepare.status !== 'ready' ? prepare : null;
  const loading = preparing?.status === 'loading';
  const disabled = Boolean(disabledReason) || sharing || loading;

  const icon =
    sharing || loading ? (
      <Loader2 className="animate-spin" aria-hidden />
    ) : preparing ? (
      <ImageDown aria-hidden />
    ) : (
      <MessageCircle aria-hidden />
    );
  const buttonText = preparing
    ? loading
      ? t('prepare.progress', { done: preparing.done, total: preparing.total })
      : t('prepare.button', { count: preparing.total })
    : more
      ? t('parts.next', { part: more.part, parts: more.parts })
      : label;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="lg"
        // Long labels (a batch's count, English) wrap inside the button instead of overflowing it.
        className="h-auto min-h-14 w-full bg-success py-2 text-center whitespace-normal text-success-foreground hover:bg-success/90"
        disabled={disabled}
        aria-describedby={disabledReason ? reasonId : undefined}
        onClick={() => (preparing ? preparing.start() : void start())}
      >
        {icon}
        {buttonText}
      </Button>
      {disabledReason ? (
        <p id={reasonId} className="type-small text-muted-foreground">
          {disabledReason}
        </p>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label={t('prepare.label')}
            aria-valuemin={0}
            aria-valuemax={preparing.total}
            aria-valuenow={preparing.done}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-success"
              style={{
                width: `${Math.round((preparing.done / preparing.total) * 100)}%`,
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={preparing.cancel}
          >
            {t('prepare.cancel')}
          </Button>
        </div>
      ) : preparing ? (
        <p className="type-small text-muted-foreground">{t('prepare.hint')}</p>
      ) : more ? (
        <p role="status" className="type-small text-muted-foreground">
          {t('parts.hint', { parts: more.parts })}
        </p>
      ) : (
        hint && <p className="type-small text-muted-foreground">{hint}</p>
      )}

      <BottomSheet
        open={asking}
        onOpenChange={(open) => {
          if (!open && !marking) setAsking(false);
        }}
        title={t('confirm.title')}
        description={confirmBody ?? t('confirm.body')}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={marking}
              onClick={() => {
                setAsking(false);
                onDeclined?.();
              }}
            >
              {t('confirm.no')}
            </Button>
            <Button
              type="button"
              disabled={marking}
              onClick={() => void confirm()}
            >
              {marking && <Loader2 className="animate-spin" aria-hidden />}
              {t('confirm.yes')}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="type-small text-destructive">
            {error}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}
