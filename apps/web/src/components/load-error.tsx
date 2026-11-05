'use client';

import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** A list or page that failed to load: the message and a retry. */
export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations('common.actions');
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-destructive p-4">
      <p role="alert" className="type-body text-destructive">
        {message}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RotateCw aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}
