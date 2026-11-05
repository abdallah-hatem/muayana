'use client';

import type { Issue } from '@muayana/shared';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { OverdueBadge } from '@/components/overdue-badge';
import { StatusChip } from '@/components/status-chip';
import { ROUTES } from '@/lib/routes';
import { IssueCover } from './issue-cover';

export const issueHref = (id: string) => `${ROUTES.issues}/${id}`;

/** "Site · location" — the location only when there is one. */
export function wherePart(issue: Pick<Issue, 'site' | 'location'>): string {
  return issue.location
    ? `${issue.site.name} · ${issue.location}`
    : issue.site.name;
}

/** An issue in the phone list: cover photo, stencil number, status, what, where and who. */
export function IssueCard({ issue }: { issue: Issue }) {
  const t = useTranslations('issues.card');
  const tCommon = useTranslations('common.labels');
  return (
    <Link
      href={issueHref(issue.id)}
      aria-label={t('open', { number: issue.number })}
      data-testid="issue-card"
      className="flex press cursor-pointer gap-3 rounded-lg border-2 border-border bg-card p-2.5 text-card-foreground hover:border-foreground/30"
    >
      <IssueCover issue={issue} className="size-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="type-stencil type-heading" dir="ltr">
            {tCommon('issueNumber', { number: issue.number })}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5">
            <OverdueBadge issue={issue} />
            <StatusChip status={issue.status} />
          </div>
        </div>
        <p className="line-clamp-2 type-small font-bold break-words">
          {issue.description || t('noDescription')}
        </p>
        <p className="truncate type-micro text-muted-foreground">
          {wherePart(issue)} · {issue.worker?.name ?? t('noWorker')}
        </p>
        {issue.estimatedDate && (
          <p className="flex items-center gap-1 type-micro text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            {t('due')}
            <span className="type-stencil text-foreground" dir="ltr">
              {issue.estimatedDate}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}
