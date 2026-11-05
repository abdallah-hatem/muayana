'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Issue } from '@muayana/shared';
import { ROUTES } from '@/lib/routes';

/** One issue in a list: number, site, description and location; overdue flagged. Opens the issue. */
export function IssueRow({ issue }: { issue: Issue }) {
  const t = useTranslations('common.labels');
  return (
    <Link
      href={`${ROUTES.issues}/${issue.id}`}
      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 border-border bg-card px-3 py-2 hover:bg-accent"
    >
      <span className="shrink-0 type-stencil" dir="ltr">
        {t('issueNumber', { number: issue.number })}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body font-bold">
          {issue.description ?? issue.location ?? issue.site.name}
        </span>
        <span className="truncate type-small text-muted-foreground">
          {[issue.site.name, issue.location].filter(Boolean).join(' · ')}
        </span>
      </span>
      {issue.overdue && (
        <span className="shrink-0 rounded-sm bg-destructive px-2 py-0.5 type-micro font-bold text-destructive-foreground uppercase">
          {t('overdue')}
        </span>
      )}
    </Link>
  );
}
