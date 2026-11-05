'use client';

import { Loader2, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { ApiResult } from '@/lib/api-result';
import type { ShareOutcome } from '@/lib/whatsapp-share';
import { useApiErrorText } from '@/components/use-api-error-text';

/**
 * The send gesture shared by one issue and a worker's batch (business §5.5): hand the message to
 * WhatsApp, then — only if the engineer didn't back out — ask "Mark as sent?". Only his yes sends
 * the status request, exactly once however fast he taps.
 */
export function SendFlow<T>({
  label,
  disabledReason,
  share,
  askToMarkSent,
  markSent,
  onMarked,
  confirmBody,
}: {
  label: string;
  /** Why sending isn't possible now; the button is disabled and this shows under it. */
  disabledReason?: string | null;
  share: () => Promise<ShareOutcome>;
  /** False when the status shouldn't change after sending (already sent or further). */
  askToMarkSent: boolean;
  markSent: () => Promise<ApiResult<T>>;
  onMarked: (data: T) => void;
  confirmBody?: string;
}) {
  const t = useTranslations('send');
  const errorText = useApiErrorText();
  const [sharing, setSharing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const reasonId = useId();

  async function start() {
    if (sharing) return;
    setSharing(true);
    const outcome = await share();
    setSharing(false);
    if (outcome === 'cancelled' || !askToMarkSent) return;
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

  const disabled = Boolean(disabledReason) || sharing;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="lg"
        className="w-full bg-success text-success-foreground hover:bg-success/90"
        disabled={disabled}
        aria-describedby={disabledReason ? reasonId : undefined}
        onClick={() => void start()}
      >
        {sharing ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <MessageCircle aria-hidden />
        )}
        {label}
      </Button>
      {disabledReason && (
        <p id={reasonId} className="type-small text-muted-foreground">
          {disabledReason}
        </p>
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
              onClick={() => setAsking(false)}
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
