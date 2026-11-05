'use client';

import { Download, Loader2, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Category, Locale, Worker } from '@muayana/shared';
import { CategoryChip } from '@/components/category-chips';
import { EmptyState } from '@/components/empty-state';
import { ListPager } from '@/components/list-pager';
import { LoadError } from '@/components/load-error';
import { SearchField } from '@/components/search-field';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagedList } from '@/components/use-paged-list';
import { usePendingAction } from '@/components/use-pending-action';
import { categoryName } from '@/lib/category-name';
import {
  exportWorkersCsv,
  listWorkers,
  type WorkerActivity,
  type WorkerFilter,
} from '@/lib/directory-endpoints';
import { saveResponse } from '@/lib/download';
import { listActiveCategories } from '@/lib/issue-endpoints';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import {
  InactiveBadge,
  WhatsAppLink,
  WorkerAvatar,
  WorkerCountChips,
} from './worker-bits';

const SEARCH_DELAY_MS = 300;

/** The search text, settled: changes once typing pauses. */
function useSettled(value: string, delay: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Workers (business §5.7): name, categories, phone, open issues by status and overdue count.
 * Search, category filter, active / deactivated, and the CSV of the same filter.
 */
export function WorkersScreen() {
  const t = useTranslations('workers');
  const locale = useLocale() as Locale;
  const [search, setSearch] = useState('');
  const settledSearch = useSettled(search, SEARCH_DELAY_MS);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [active, setActive] = useState<WorkerActivity>('true');
  const [categories, setCategories] = useState<Category[]>([]);
  const exporting = usePendingAction();

  const filter: WorkerFilter = { search: settledSearch, categoryId, active };
  const fetchPage = useCallback(
    (page: number, limit: number, signal: AbortSignal) =>
      listWorkers(
        { search: settledSearch, categoryId, active },
        page,
        limit,
        signal,
      ),
    [settledSearch, categoryId, active],
  );
  const list = usePagedList(fetchPage);

  useEffect(() => {
    let live = true;
    void listActiveCategories().then((res) => {
      if (live && res.success) setCategories(res.data);
    });
    return () => {
      live = false;
    };
  }, []);

  async function exportCsv() {
    await exporting.run(async () => {
      const res = await exportWorkersCsv(filter, locale);
      if (res?.ok) await saveResponse(res, 'workers.csv');
      else if (res?.status !== 401) toast.error(t('exportFailed'));
    });
  }

  const filtered = settledSearch.trim() !== '' || categoryId !== null;
  const empty = filtered
    ? { title: t('empty.filteredTitle'), body: t('empty.filteredBody') }
    : active === 'false'
      ? { title: t('empty.inactiveTitle'), body: t('empty.inactiveBody') }
      : { title: t('empty.title'), body: t('empty.body') };

  return (
    <section
      data-testid="screen-workers"
      className="mx-auto flex w-full max-w-5xl flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={exporting.pending}
          onClick={() => void exportCsv()}
        >
          {exporting.pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Download aria-hidden />
          )}
          {exporting.pending ? t('exporting') : t('export')}
        </Button>
        <Button asChild>
          <Link href={`${ROUTES.workers}/new`} aria-label={t('newLong')}>
            <Plus aria-hidden />
            {t('new')}
          </Link>
        </Button>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
      />
      <div
        role="group"
        aria-label={t('filterLabel')}
        className="-mx-4 flex scrollbar-clean gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        <CategoryChip
          category={null}
          pressed={categoryId === null}
          onClick={() => setCategoryId(null)}
        >
          {t('allCategories')}
        </CategoryChip>
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            pressed={category.id === categoryId}
            onClick={() =>
              setCategoryId(category.id === categoryId ? null : category.id)
            }
          />
        ))}
      </div>
      <Segmented
        label={t('activity.label')}
        value={active}
        onChange={setActive}
        options={[
          { value: 'true', label: t('activity.true') },
          { value: 'false', label: t('activity.false') },
        ]}
      />

      {list.status === 'loading' ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : list.status === 'error' ? (
        <LoadError message={t('loadFailed')} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={empty.title}
          body={empty.body}
          action={
            filtered || active === 'false' ? undefined : (
              <Button asChild>
                <Link href={`${ROUTES.workers}/new`}>
                  <Plus aria-hidden />
                  {t('newLong')}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div
            aria-busy={list.refreshing}
            className={cn(
              'transition-opacity',
              list.refreshing && 'opacity-60',
            )}
          >
            <WorkerCards workers={list.items} locale={locale} />
            <WorkerTable workers={list.items} locale={locale} />
          </div>
          <ListPager
            page={list.page}
            limit={list.limit}
            total={list.total}
            disabled={list.refreshing}
            onPageChange={list.setPage}
            onLimitChange={list.setLimit}
          />
        </>
      )}
    </section>
  );
}

const href = (worker: Worker) => `${ROUTES.workers}/${worker.id}`;

const categoryNames = (worker: Worker, locale: Locale) =>
  worker.categories.map((c) => categoryName(c, locale)).join(' · ');

/** Phones: one card per worker (the mockup's screen 5). */
function WorkerCards({
  workers,
  locale,
}: {
  workers: Worker[];
  locale: Locale;
}) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {workers.map((worker) => (
        <li
          key={worker.id}
          data-testid="worker-card"
          className="relative flex items-start gap-3 rounded-lg border-2 border-border bg-card p-3 shadow-card"
        >
          <WorkerAvatar name={worker.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* The badge wraps under a name that needs the room: a name is never cut for it. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={href(worker)}
                dir="auto"
                className="max-w-full min-w-0 cursor-pointer truncate text-start type-body font-bold after:absolute after:inset-0 after:content-['']"
              >
                {worker.name}
              </Link>
              {!worker.active && <InactiveBadge />}
            </div>
            <p className="truncate type-small text-muted-foreground">
              {categoryNames(worker, locale)}
            </p>
            <WorkerCountChips counts={worker.counts} />
          </div>
          <WhatsAppLink worker={worker} className="relative z-10" />
        </li>
      ))}
    </ul>
  );
}

/** md and up: a table. */
function WorkerTable({
  workers,
  locale,
}: {
  workers: Worker[];
  locale: Locale;
}) {
  const t = useTranslations('workers.columns');
  return (
    <div className="hidden scrollbar-clean overflow-x-auto rounded-lg border-2 border-border bg-card md:block">
      <table className="w-full type-small">
        <thead className="border-b-2 border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-start font-bold">{t('name')}</th>
            <th className="px-4 py-3 text-start font-bold">
              {t('categories')}
            </th>
            <th className="px-4 py-3 text-start font-bold">{t('phone')}</th>
            <th className="px-4 py-3 text-start font-bold">{t('open')}</th>
            <th className="px-4 py-3 text-end font-bold">{t('contact')}</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr
              key={worker.id}
              className="border-b border-border last:border-b-0 hover:bg-accent"
            >
              <td className="max-w-60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <WorkerAvatar name={worker.name} className="size-9" />
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={href(worker)}
                      dir="auto"
                      className="max-w-full min-w-0 cursor-pointer truncate text-start font-bold hover:underline"
                    >
                      {worker.name}
                    </Link>
                    {!worker.active && <InactiveBadge />}
                  </div>
                </div>
              </td>
              <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">
                {categoryNames(worker, locale)}
              </td>
              <td className="px-4 py-3 font-mono whitespace-nowrap" dir="ltr">
                {worker.phone}
              </td>
              <td className="px-4 py-3">
                <WorkerCountChips counts={worker.counts} />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <WhatsAppLink worker={worker} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
