'use client';

import type { Issue, Locale } from '@muayana/shared';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { OverdueBadge } from '@/components/overdue-badge';
import { StatusChip } from '@/components/status-chip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { categoryName } from '@/lib/format';
import { IssueCover } from './issue-cover';
import { issueHref, wherePart } from './issue-card';

/**
 * The issues list from xl up (cards below): one row per issue, the number links to its page.
 * Fixed columns stay narrow so the description keeps the room; the location sits under the
 * description and the worker under the category. Below the minimum width the table scrolls.
 */
export function IssuesTable({ issues }: { issues: Issue[] }) {
  const t = useTranslations('issues');
  const tCommon = useTranslations('common.labels');
  const locale = useLocale() as Locale;

  return (
    <Table className="min-w-[52rem] table-fixed">
      <caption className="sr-only">{t('table.caption')}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-20">{t('table.number')}</TableHead>
          <TableHead className="w-18">
            <span className="sr-only">{t('table.photo')}</span>
          </TableHead>
          <TableHead>
            {t('table.description')}
            <span className="font-normal normal-case"> · </span>
            {t('table.location')}
          </TableHead>
          <TableHead className="w-36">{t('table.status')}</TableHead>
          <TableHead className="w-44">
            {t('table.category')}
            <span className="font-normal normal-case"> · </span>
            {t('table.worker')}
          </TableHead>
          <TableHead className="w-32">{t('table.estimate')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.id} data-testid="issue-row">
            <TableCell>
              <Link
                href={issueHref(issue.id)}
                aria-label={t('card.open', { number: issue.number })}
                className="inline-flex min-h-11 cursor-pointer items-center type-stencil type-heading underline-offset-4 hover:underline"
                dir="ltr"
              >
                {tCommon('issueNumber', { number: issue.number })}
              </Link>
            </TableCell>
            <TableCell>
              <IssueCover issue={issue} className="size-12" />
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  dir="auto"
                  className="line-clamp-2 text-start font-bold break-words"
                >
                  {issue.description || t('card.noDescription')}
                </span>
                <span
                  dir="auto"
                  className="truncate text-start type-micro text-muted-foreground"
                >
                  {wherePart(issue)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <StatusChip status={issue.status} />
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">
                  {issue.category ? categoryName(issue.category, locale) : '—'}
                </span>
                <span
                  dir="auto"
                  className="truncate text-start type-micro text-muted-foreground"
                >
                  {issue.worker?.name ?? t('card.noWorker')}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1">
                {issue.estimatedDate && (
                  <span className="type-stencil" dir="ltr">
                    {issue.estimatedDate}
                  </span>
                )}
                <OverdueBadge issue={issue} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
