'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Worker } from '@muayana/shared';
import { STATUS_TONE } from '@/components/status-chip';
import { whatsappChatUrl } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

/** The statuses a worker's open count chips show, in workflow order. */
const COUNTED = ['assigned', 'sent', 'estimated', 'in_progress'] as const;

/** The worker's open issues by status, and the overdue count (business §5.7). Zeros are left out. */
export function WorkerCountChips({
  counts,
  withSolved = false,
}: {
  counts: Worker['counts'];
  withSolved?: boolean;
}) {
  const t = useTranslations('workers');
  const statuses = withSolved ? [...COUNTED, 'solved' as const] : COUNTED;
  const shown = statuses.filter((s) => counts[s] > 0);
  if (shown.length === 0 && counts.overdue === 0)
    return (
      <span className="type-small text-muted-foreground">{t('noOpen')}</span>
    );
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((status) => (
        <span
          key={status}
          data-count={status}
          className={cn(
            'inline-flex h-6 items-center rounded-sm px-2 type-micro font-bold whitespace-nowrap',
            STATUS_TONE[status],
          )}
        >
          {t(`count.${status}`, { count: counts[status] })}
        </span>
      ))}
      {counts.overdue > 0 && (
        <span
          data-count="overdue"
          className="inline-flex h-6 items-center rounded-sm bg-destructive px-2 type-micro font-bold whitespace-nowrap text-destructive-foreground"
        >
          {t('count.overdue', { count: counts.overdue })}
        </span>
      )}
    </span>
  );
}

/** The worker's initial on an ink tile (the mockup's avatar). */
export function WorkerAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initial = Array.from(name.trim())[0] ?? '?';
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg bg-foreground type-heading text-primary',
        className,
      )}
    >
      {initial}
    </span>
  );
}

/** "Deactivated" stamp next to a worker's name (business §3: he keeps his issues). */
export function InactiveBadge() {
  const t = useTranslations('workers');
  return (
    <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 type-micro font-bold text-muted-foreground uppercase">
      {t('inactiveBadge')}
    </span>
  );
}

/** Opens a WhatsApp chat with the worker (no message). */
export function WhatsAppLink({
  worker,
  className,
}: {
  worker: Pick<Worker, 'name' | 'phone'>;
  className?: string;
}) {
  const t = useTranslations('workers');
  return (
    <a
      href={whatsappChatUrl(worker.phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp', { name: worker.name })}
      title={t('whatsapp', { name: worker.name })}
      className={cn(
        'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-success hover:bg-accent',
        className,
      )}
    >
      <MessageCircle className="size-6" aria-hidden />
    </a>
  );
}
