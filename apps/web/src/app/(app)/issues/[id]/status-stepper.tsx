'use client';

import { useTranslations } from 'next-intl';
import { statusIndex, type IssueStatus } from '@muayana/shared';
import { cn } from '@/lib/utils';

/** The lifecycle from sorted to solved; `new` comes before it and `cancelled` leaves it. */
const STEPS: readonly IssueStatus[] = [
  'unassigned',
  'assigned',
  'sent',
  'estimated',
  'in_progress',
  'solved',
];

/** Tape segments filled up to the current status (the mockup's stepper). */
export function StatusStepper({ status }: { status: IssueStatus }) {
  const t = useTranslations('issue');
  const tStatus = useTranslations('common.status');
  if (status === 'cancelled') return null;
  const reached = STEPS.filter((s) => statusIndex(s) <= statusIndex(status));

  return (
    <div
      role="img"
      aria-label={t('stepper', {
        current: reached.length,
        total: STEPS.length,
        status: tStatus(status),
      })}
      className="flex gap-1"
    >
      {STEPS.map((step) => (
        <span
          key={step}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            reached.includes(step) ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}
