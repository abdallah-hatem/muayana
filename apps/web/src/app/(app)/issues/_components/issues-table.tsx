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

/** The issues list from md up: one row per issue, the number links to its page. */
export function IssuesTable({ issues }: { issues: Issue[] }) {
  const t = useTranslations('issues');
  const tCommon = useTranslations('common.labels');
  const locale = useLocale() as Locale;

  return (
    <Table className="table-fixed">
      <caption className="sr-only">{t('table.caption')}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-20">{t('table.number')}</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">{t('table.photo')}</span>
          </TableHead>
          <TableHead>{t('table.description')}</TableHead>
          <TableHead className="w-40">{t('table.status')}</TableHead>
          <TableHead className="w-32">{t('table.category')}</TableHead>
          <TableHead className="w-32">{t('table.worker')}</TableHead>
          <TableHead className="w-44">{t('table.location')}</TableHead>
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
                className="cursor-pointer type-stencil type-heading underline-offset-4 hover:underline"
                dir="ltr"
              >
                {tCommon('issueNumber', { number: issue.number })}
              </Link>
            </TableCell>
            <TableCell>
              <IssueCover issue={issue} className="size-12" />
            </TableCell>
            <TableCell>
              <span className="line-clamp-2 font-bold break-words">
                {issue.description || t('card.noDescription')}
              </span>
            </TableCell>
            <TableCell>
              <StatusChip status={issue.status} />
            </TableCell>
            <TableCell className="truncate">
              {issue.category ? categoryName(issue.category, locale) : '—'}
            </TableCell>
            <TableCell className="truncate">
              {issue.worker?.name ?? t('card.noWorker')}
            </TableCell>
            <TableCell className="truncate text-muted-foreground">
              {wherePart(issue)}
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
