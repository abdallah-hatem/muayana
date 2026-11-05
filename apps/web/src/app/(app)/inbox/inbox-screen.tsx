'use client';

import { CheckCheck, ListChecks, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { Category, Issue } from '@muayana/shared';
import { useSiteSelection } from '@/components/site/site-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { listActiveCategories, listInboxIssues } from '@/lib/issue-endpoints';
import { ROUTES } from '@/lib/routes';
import { BulkPanel } from './bulk-panel';
import { SortCard } from './sort-card';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; issues: Issue[]; categories: Category[] };

/**
 * The sort inbox (business §5.3): the `new` issues of the chosen site (or all sites), oldest first,
 * sorted one at a time — or several at once in bulk mode.
 */
export function InboxScreen() {
  const t = useTranslations('inbox');
  const { siteId, ready } = useSiteSelection();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [index, setIndex] = useState(0);
  const [bulk, setBulk] = useState(false);

  const fetchAll = useCallback(async () => {
    const [issues, categories] = await Promise.all([
      listInboxIssues(siteId),
      listActiveCategories(),
    ]);
    if (!issues.success || !categories.success)
      return { state: 'error' as const };
    return {
      state: 'ready' as const,
      issues: issues.data,
      categories: categories.data,
    };
  }, [siteId]);

  const reload = useCallback(() => {
    void fetchAll().then((next) => {
      setLoad(next);
      setIndex(0);
    });
  }, [fetchAll]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void fetchAll().then((next) => {
      if (!live) return;
      setLoad(next);
      setIndex(0);
    });
    return () => {
      live = false;
    };
  }, [ready, fetchAll]);

  if (load.state === 'loading') return <InboxSkeleton />;

  if (load.state === 'error')
    return (
      <Shell>
        <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-destructive p-4">
          <p role="alert" className="type-body text-destructive">
            {t('loadFailed')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoad({ state: 'loading' });
              reload();
            }}
          >
            <RotateCw aria-hidden />
            {t('retry')}
          </Button>
        </div>
      </Shell>
    );

  const { issues, categories } = load;

  if (issues.length === 0)
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center">
          <div className="h-3 w-24 rounded-sm hazard-stripe" aria-hidden />
          <CheckCheck className="size-10 text-success" aria-hidden />
          <p className="type-heading">{t('empty.title')}</p>
          <p className="type-body text-muted-foreground">{t('empty.body')}</p>
          <Button asChild variant="outline">
            <Link href={ROUTES.issues}>{t('empty.toIssues')}</Link>
          </Button>
        </div>
      </Shell>
    );

  const position = Math.min(index, issues.length - 1);
  const issue = issues[position];

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <p className="type-small font-bold text-muted-foreground">
          {bulk ? (
            t('count', { count: issues.length })
          ) : (
            <span className="type-stencil" dir="ltr">
              {t('position', { current: position + 1, total: issues.length })}
            </span>
          )}
        </p>
        <Button
          type="button"
          variant={bulk ? 'default' : 'outline'}
          size="sm"
          aria-pressed={bulk}
          onClick={() => setBulk((b) => !b)}
        >
          <ListChecks aria-hidden />
          {bulk ? t('sortOneByOne') : t('selectSeveral')}
        </Button>
      </div>

      {bulk ? (
        <BulkPanel issues={issues} categories={categories} onChanged={reload} />
      ) : (
        <SortCard
          key={issue.id}
          issue={issue}
          categories={categories}
          canGoBack={position > 0}
          onBack={() => setIndex(Math.max(0, position - 1))}
          onSkip={() => setIndex((position + 1) % issues.length)}
          onSaved={(saved) => {
            setLoad({
              state: 'ready',
              categories,
              issues: issues.filter((i) => i.id !== saved.id),
            });
            // The next issue slides into this position; past the end, wrap to the first.
            setIndex(position >= issues.length - 1 ? 0 : position);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-testid="screen-inbox"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4"
    >
      {children}
    </section>
  );
}

function InboxSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="-mx-4 aspect-[4/3] rounded-none md:mx-0 md:rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </Shell>
  );
}
