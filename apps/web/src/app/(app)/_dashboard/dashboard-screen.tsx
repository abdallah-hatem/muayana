'use client';

import { UuidSchema, type Dashboard, type Locale } from '@muayana/shared';
import { ArrowRight, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useSiteSelection } from '@/components/site/site-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { clientFetch } from '@/lib/api-client';
import { categoryName, formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { INBOX_HREF, dashboardLinks, openCount } from './dashboard-links';

type Load =
  | { state: 'loading' }
  | { state: 'error'; key: string }
  | { state: 'ready'; key: string; data: Dashboard };

/**
 * The dashboard (§5.9). Scoped to the site chosen in the top bar's site switcher when there is one
 * (with a way back to all sites), and reloads the moment the switcher changes; every number opens
 * the issues list filtered to it.
 */
export function DashboardScreen() {
  const selection = useSiteSelection();
  // A remembered value that is not an id (old or broken storage) means all sites.
  const siteId =
    selection.siteId && UuidSchema.safeParse(selection.siteId).success
      ? selection.siteId
      : undefined;
  const [fetched, setFetched] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = `${siteId ?? ''}#${attempt}`;
  // A result for another site (or an earlier attempt) is not shown: the skeleton is, until the
  // current one arrives.
  const load: Load =
    fetched.state !== 'loading' && fetched.key === key
      ? fetched
      : { state: 'loading' };

  useEffect(() => {
    // Wait for the remembered site, so "all sites" is not fetched first.
    if (!selection.ready) return;
    let alive = true;
    const controller = new AbortController();
    const path = siteId
      ? `/dashboard?siteId=${encodeURIComponent(siteId)}`
      : '/dashboard';
    void clientFetch<Dashboard>(path, { signal: controller.signal }).then(
      (res) => {
        if (!alive) return;
        setFetched(
          res.success && res.data
            ? { state: 'ready', key, data: res.data }
            : { state: 'error', key },
        );
      },
    );
    return () => {
      alive = false;
      controller.abort();
    };
  }, [selection.ready, siteId, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (load.state === 'loading') return <DashboardSkeleton />;
  if (load.state === 'error') return <DashboardError onRetry={retry} />;
  return (
    <DashboardView
      data={load.data}
      siteId={siteId}
      onAllSites={() => selection.setSiteId(null)}
    />
  );
}

export function DashboardView({
  data,
  siteId,
  onAllSites,
}: {
  data: Dashboard;
  siteId?: string;
  onAllSites?: () => void;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const links = dashboardLinks(siteId);
  const siteName = siteId
    ? data.bySite.find((s) => s.site.id === siteId)?.site.name
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {siteId && (
        <div className="flex flex-wrap items-center gap-2">
          {/* The words stay whole; only the site name (isolated, so an Arabic name can't reorder
              the English sentence) ends in an ellipsis. */}
          <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 type-small font-bold whitespace-nowrap text-secondary-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {t.rich('site.showing', {
              site: siteName ?? '…',
              name: (chunks) => (
                <bdi dir="auto" className="min-w-0 truncate">
                  {chunks}
                </bdi>
              ),
            })}
          </span>
          {onAllSites && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAllSites}
            >
              <X aria-hidden />
              {t('site.all')}
            </Button>
          )}
        </div>
      )}

      <InboxCard count={data.inbox} />

      <section aria-label={t('stats.label')}>
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatTile
            href={links.open}
            value={openCount(data.byStatus)}
            label={t('stats.open')}
            testId="stat-open"
          />
          <StatTile
            href={links.overdue}
            value={data.overdue}
            label={t('stats.overdue')}
            tone="danger"
            testId="stat-overdue"
          />
          <StatTile
            href={links.status('sent')}
            value={data.byStatus.sent ?? 0}
            label={t('stats.sent')}
            testId="stat-sent"
          />
          <StatTile
            href={links.status('solved')}
            value={data.byStatus.solved ?? 0}
            label={t('stats.solved')}
            testId="stat-solved"
          />
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <BarGroup
          title={t('bars.byCategory')}
          testId="bars-category"
          rows={data.byCategory.map((row) => ({
            id: row.category.id,
            name: categoryName(row.category, locale),
            color: row.category.color,
            open: row.open,
            overdue: row.overdue,
            href: links.category(row.category.id),
            overdueHref: links.category(row.category.id, true),
          }))}
        />
        <BarGroup
          title={t('bars.byWorker')}
          testId="bars-worker"
          rows={data.byWorker.map((row) => ({
            id: row.worker.id,
            name: row.worker.name,
            open: row.open,
            overdue: row.overdue,
            href: links.worker(row.worker.id),
            overdueHref: links.worker(row.worker.id, true),
          }))}
        />
        <BarGroup
          title={t('bars.bySite')}
          testId="bars-site"
          rows={data.bySite.map((row) => ({
            id: row.site.id,
            name: row.site.name,
            open: row.open,
            overdue: row.overdue,
            href: links.site(row.site.id),
            overdueHref: links.site(row.site.id, true),
          }))}
        />
      </div>
    </div>
  );
}

/** Unsorted captures, framed in hazard tape, with the way into the sort inbox. */
function InboxCard({ count }: { count: number }) {
  const t = useTranslations('dashboard.inbox');
  return (
    <div className="rounded-lg hazard-stripe p-1">
      <div className="flex items-center justify-between gap-3 rounded-md bg-hazard-b p-4 text-background dark:text-foreground">
        <div className="flex min-w-0 flex-col">
          <span className="type-small font-bold text-hazard-a">
            {t('title')}
          </span>
          <span className="type-stencil type-display" data-testid="inbox-count">
            {formatCount(count)}
          </span>
        </div>
        <Button asChild>
          <Link href={INBOX_HREF} data-testid="inbox-start">
            {t('start')}
            <ArrowRight className="flip-rtl" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatTile({
  href,
  value,
  label,
  tone,
  testId,
}: {
  href: string;
  value: number;
  label: string;
  tone?: 'danger';
  testId: string;
}) {
  return (
    <li>
      <Link
        href={href}
        data-testid={testId}
        className={cn(
          'flex h-full press cursor-pointer flex-col gap-1 rounded-lg border-2 bg-card p-3 hover:border-foreground/40',
          tone === 'danger' && value > 0
            ? 'border-destructive'
            : 'border-border',
        )}
      >
        <span
          className={cn(
            'type-stencil type-display',
            tone === 'danger' && value > 0 && 'text-destructive',
          )}
        >
          {formatCount(value)}
        </span>
        <span className="type-micro text-muted-foreground">{label}</span>
      </Link>
    </li>
  );
}

type BarRow = {
  id: string;
  name: string;
  /** The entity's own colour (categories); others use the brand ink. */
  color?: string;
  open: number;
  overdue: number;
  href: string;
  overdueHref: string;
};

/**
 * Open issues per trade / worker / site as horizontal bars (one series: length is the count,
 * the label and number always beside it). Each row opens the list filtered to it; its overdue
 * count opens the overdue ones.
 */
function BarGroup({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: BarRow[];
  testId: string;
}) {
  const t = useTranslations('dashboard.bars');
  const shown = rows
    .filter((r) => r.open > 0 || r.overdue > 0)
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const max = Math.max(1, ...shown.map((r) => r.open));

  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 rounded-lg border-2 border-border bg-card p-4"
    >
      <h2 className="type-heading">{title}</h2>
      {shown.length === 0 ? (
        <p className="type-small text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <Link
                href={row.href}
                aria-label={t('open', { name: row.name, count: row.open })}
                data-testid="bar-link"
                className="grid min-h-11 min-w-0 flex-1 cursor-pointer grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2.5 rounded-md px-1 hover:bg-accent/60"
              >
                <span
                  dir="auto"
                  className="truncate text-start type-small font-bold"
                >
                  {row.name}
                </span>
                <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      !row.color && 'bg-primary-ink',
                    )}
                    style={{
                      width: `${(row.open / max) * 100}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </span>
                <span className="type-stencil type-small">
                  {formatCount(row.open)}
                </span>
              </Link>
              {row.overdue > 0 && (
                <Link
                  href={row.overdueHref}
                  aria-label={t('overdueLabel', {
                    name: row.name,
                    count: row.overdue,
                  })}
                  data-testid="bar-overdue-link"
                  // The red stamp stays small; the link around it is a full 44px tap target.
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center"
                >
                  <span className="inline-flex min-h-8 items-center rounded-sm bg-destructive px-2 type-micro font-bold text-destructive-foreground">
                    {t('overdue', { count: formatCount(row.overdue) })}
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  const t = useTranslations('dashboard');
  return (
    <div
      aria-busy="true"
      aria-label={t('loading')}
      className="mx-auto flex w-full max-w-5xl flex-col gap-5"
    >
      <Skeleton className="h-28 rounded-lg" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('dashboard');
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border-2 border-destructive/40 p-6 text-center">
      <p role="alert" className="type-body text-destructive">
        {t('error')}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}
