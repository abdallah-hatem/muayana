'use client';

import type { Locale } from '@muayana/shared';
import { CalendarClock, Images, MapPin, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/status-chip';
import { MOCK_ISSUE } from './samples';

/** Mock of the issue card used in lists (T12): photo first, stencil number, stamped status. */
export function MockIssueCard({ locale }: { locale: Locale }) {
  const t = useTranslations('common');
  const issue = MOCK_ISSUE;
  return (
    <article className="flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-foreground/10 bg-card text-card-foreground shadow-card">
      <div className="relative aspect-[4/3] bg-linear-to-br from-secondary to-muted">
        <div
          className="absolute inset-x-0 top-0 h-2 hazard-stripe"
          aria-hidden
        />
        <span className="absolute end-3 bottom-3 inline-flex items-center gap-1.5 rounded-sm bg-foreground/80 px-2 py-1 type-small text-background">
          <Images className="size-4" aria-hidden />
          {t('labels.photos', { count: issue.photos })}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="type-stencil type-title" dir="ltr">
            {t('labels.issueNumber', { number: issue.number })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {issue.overdue && (
              <span className="inline-flex h-7 items-center rounded-sm border-2 border-destructive px-2 type-micro font-bold text-destructive uppercase">
                {t('labels.overdue')}
              </span>
            )}
            <StatusChip status={issue.status} />
          </div>
        </div>
        <p className="line-clamp-2 type-heading">{issue.description[locale]}</p>
        <ul className="flex flex-col gap-1.5 type-small text-muted-foreground">
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {issue.site[locale]} · {issue.location[locale]}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <User className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{issue.worker[locale]}</span>
            <span className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 type-micro text-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: issue.categoryColor }}
                aria-hidden
              />
              {issue.category[locale]}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span className="type-stencil" dir="ltr">
              {issue.estimatedDate}
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
}
