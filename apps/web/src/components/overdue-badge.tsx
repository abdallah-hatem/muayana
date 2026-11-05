'use client';

import { isOverdue, type IssueStatus } from '@muayana/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * The overdue stamp (§4): shown iff `isOverdue` — an estimated date before today in Cairo on an
 * issue that isn't solved or cancelled. Computed here from the date, never trusted from a flag.
 */
export function OverdueBadge({
  issue,
  now,
  className,
}: {
  issue: { status: IssueStatus; estimatedDate: string | null };
  /** Today, for tests; the current time by default. */
  now?: Date;
  className?: string;
}) {
  const t = useTranslations('common.labels');
  if (!isOverdue(issue, now ?? new Date())) return null;
  return (
    <span
      data-testid="overdue-badge"
      className={cn(
        'inline-flex h-7 items-center rounded-sm bg-destructive px-2 type-micro font-bold whitespace-nowrap text-destructive-foreground uppercase',
        className,
      )}
    >
      {t('overdue')}
    </span>
  );
}
