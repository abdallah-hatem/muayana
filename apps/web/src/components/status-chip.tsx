'use client';

import type { IssueStatus } from '@muayana/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Fill + text token per status. Literal class names so Tailwind sees every one. */
export const STATUS_TONE: Record<IssueStatus, string> = {
  new: 'bg-status-new text-status-new-foreground',
  unassigned: 'bg-status-unassigned text-status-unassigned-foreground',
  assigned: 'bg-status-assigned text-status-assigned-foreground',
  sent: 'bg-status-sent text-status-sent-foreground',
  estimated: 'bg-status-estimated text-status-estimated-foreground',
  in_progress: 'bg-status-in-progress text-status-in-progress-foreground',
  solved: 'bg-status-solved text-status-solved-foreground',
  cancelled:
    'bg-status-cancelled text-status-cancelled-foreground line-through decoration-2',
};

/** A dot in the status colour, for lists and bars (always next to a label). */
export const STATUS_DOT: Record<IssueStatus, string> = {
  new: 'bg-status-new',
  unassigned: 'bg-status-unassigned',
  assigned: 'bg-status-assigned',
  sent: 'bg-status-sent',
  estimated: 'bg-status-estimated',
  in_progress: 'bg-status-in-progress',
  solved: 'bg-status-solved',
  cancelled: 'bg-status-cancelled',
};

/**
 * A status stamped like a label: solid fill, heavy, uppercase in English. Never colour alone —
 * the translated label is always there. `stamp` plays the stamp-in when it appears.
 */
export function StatusChip({
  status,
  stamp = false,
  className,
}: {
  status: IssueStatus;
  stamp?: boolean;
  className?: string;
}) {
  const t = useTranslations('common.status');
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex h-7 items-center rounded-sm px-2.5 type-micro font-bold whitespace-nowrap uppercase',
        STATUS_TONE[status],
        stamp && 'motion-safe:animate-stamp-in',
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
