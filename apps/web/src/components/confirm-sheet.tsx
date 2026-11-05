'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/ui/button';

/**
 * "Are you sure?" from the bottom edge: a title, what will happen, and the confirming action, busy
 * while its request runs. `error` shows a refusal in place; `alternative` offers another way out
 * in place of the confirming action (e.g. "Archive instead" when a delete is refused; `null` offers
 * nothing but Cancel).
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  destructive = false,
  busy,
  error,
  alternative,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  error?: string | null;
  alternative?: React.ReactNode;
  onConfirm: () => void;
}) {
  const t = useTranslations('common.actions');
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={title}
      description={body}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          {alternative !== undefined ? (
            alternative
          ) : (
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <p role="alert" className="type-small font-bold text-destructive">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
