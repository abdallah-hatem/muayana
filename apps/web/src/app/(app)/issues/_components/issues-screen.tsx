'use client';

import {
  IssueSortSchema,
  type IssueSort,
  type ParsedIssueFilter,
} from '@muayana/shared';
import { FileSpreadsheet, SearchIcon, SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  clearedFilter,
  filterParts,
  filterToSearchParams,
  searchParamsToFilter,
  withoutPart,
} from '@/lib/issue-filter-url';
import { cn } from '@/lib/utils';
import { ExportDialog } from './export-dialog';
import { FilterChips } from './filter-chips';
import { FilterForm } from './filter-form';
import { IssueCard } from './issue-card';
import { IssuesTable } from './issues-table';
import { useFilterOptions } from './use-filter-options';
import { useIssuesList } from './use-issues-list';

/**
 * The issues list (§5.8). The filter lives in the address: every control writes the URL (without
 * scrolling) and the list reads it back, so reload, back/forward and bookmarks all keep it.
 */
export function IssuesScreen() {
  const t = useTranslations('issues');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParamsToFilter(searchParams);
  const options = useFilterOptions();
  const list = useIssuesList(filter);
  const [exportOpen, setExportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = filterParts(filter).length;

  const apply = (next: ParsedIssueFilter) => {
    const qs = filterToSearchParams(next).toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <aside
        aria-label={t('filters.title')}
        data-testid="filter-panel"
        className="hidden w-80 shrink-0 rounded-lg border-2 border-border bg-card p-4 lg:sticky lg:top-20 lg:block lg:scrollbar-clean lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
      >
        <h2 className="mb-4 type-heading">{t('filters.title')}</h2>
        <FilterForm value={filter} onChange={apply} options={options} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <SearchBox
            value={filter.q}
            onCommit={(q) => apply({ ...filter, q })}
          />
          <SortSelect
            value={filter.sort}
            onChange={(sort) => apply({ ...filter, sort })}
          />
          <Button
            type="button"
            className="lg:hidden"
            data-testid="open-filters"
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal aria-hidden />
            {t('filters.button')}
            {activeCount > 0 && (
              <span className="type-stencil" data-testid="filter-count">
                {activeCount}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="open-export"
            onClick={() => setExportOpen(true)}
          >
            <FileSpreadsheet aria-hidden />
            <span>{t('export')}</span>
          </Button>
        </div>

        <FilterChips
          filter={filter}
          options={options}
          onRemove={(part) => apply(withoutPart(filter, part))}
          onClearAll={() => apply(clearedFilter(filter))}
        />

        <p
          className="min-h-5 type-small text-muted-foreground"
          aria-live="polite"
          data-testid="issues-count"
        >
          {list.total !== null && t('list.count', { count: list.total })}
        </p>

        <IssuesResults
          list={list}
          filtered={activeCount > 0}
          onClearAll={() => apply(clearedFilter(filter))}
        />
      </section>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filter={filter}
        options={options}
        onApply={(next) => {
          apply(next);
          setSheetOpen(false);
        }}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        filter={filter}
        total={list.total}
      />
    </div>
  );
}

function IssuesResults({
  list,
  filtered,
  onClearAll,
}: {
  list: ReturnType<typeof useIssuesList>;
  filtered: boolean;
  onClearAll: () => void;
}) {
  const t = useTranslations('issues');

  if (list.loading) return <ListSkeleton />;
  if (list.error && list.issues.length === 0)
    return <ListError onRetry={list.retry} />;
  if (list.total === 0)
    return <EmptyState filtered={filtered} onClearAll={onClearAll} />;

  return (
    <div
      aria-busy={list.refreshing}
      className={cn(
        'flex flex-col gap-3 transition-opacity',
        list.refreshing && 'pointer-events-none opacity-50',
      )}
    >
      <ul className="flex flex-col gap-2.5 md:hidden">
        {list.issues.map((issue) => (
          <li key={issue.id}>
            <IssueCard issue={issue} />
          </li>
        ))}
      </ul>
      <div className="hidden rounded-lg border-2 border-border bg-card md:block">
        <IssuesTable issues={list.issues} />
      </div>
      {list.error ? (
        <ListError onRetry={list.retry} />
      ) : (
        list.hasMore && (
          <LoadMore busy={list.loadingMore} onLoad={list.loadMore}>
            {t('list.loadMore')}
          </LoadMore>
        )
      )}
    </div>
  );
}

/** Loads the next page when it scrolls into view; a button for keyboards and old browsers. */
function LoadMore({
  busy,
  onLoad,
  children,
}: {
  busy: boolean;
  onLoad: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      onClick={onLoad}
      disabled={busy}
      data-testid="load-more"
      className="self-center"
    >
      {children}
    </Button>
  );
}

function SearchBox({
  value,
  onCommit,
}: {
  value: string | undefined;
  onCommit: (q: string | undefined) => void;
}) {
  const t = useTranslations('issues.search');
  const id = useId();
  const [text, setText] = useState(value ?? '');
  const [committed, setCommitted] = useState(value);
  // The address changed from elsewhere (a chip removed, clear all, back): show its search.
  if (value !== committed) {
    setCommitted(value);
    if ((value ?? '') !== text.trim()) setText(value ?? '');
  }
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === committed) return;
    const timer = setTimeout(() => onCommitRef.current(next), 300);
    return () => clearTimeout(timer);
  }, [text, committed]);

  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1">
      <Label htmlFor={id} className="sr-only">
        {t('label')}
      </Label>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          className="ps-10"
          maxLength={120}
        />
      </div>
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: IssueSort;
  onChange: (sort: IssueSort) => void;
}) {
  const t = useTranslations('issues.sort');
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="sr-only">
        {t('label')}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as IssueSort)}>
        <SelectTrigger
          id={id}
          aria-label={t('label')}
          className="min-w-40 cursor-pointer"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {IssueSortSchema.options.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {t(sort)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The phone's filter editor: a bottom sheet with a draft, applied with "show results". */
function FilterSheet({
  open,
  onOpenChange,
  filter,
  options,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ParsedIssueFilter;
  options: ReturnType<typeof useFilterOptions>;
  onApply: (next: ParsedIssueFilter) => void;
}) {
  const t = useTranslations('issues.filters');
  const [draft, setDraft] = useState(filter);
  const [wasOpen, setWasOpen] = useState(open);
  // Each opening starts from the filter in the address.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(filter);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 rounded-t-xl border-t-2"
      >
        <SheetHeader className="border-b-2 p-4 pe-12">
          <SheetTitle className="type-title">{t('title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('title')}</SheetDescription>
        </SheetHeader>
        <div className="scrollbar-clean min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <FilterForm value={draft} onChange={setDraft} options={options} />
        </div>
        <SheetFooter className="flex-row gap-2 border-t-2 p-4 pb-safe">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setDraft(clearedFilter(draft))}
          >
            {t('clearAll')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            data-testid="apply-filters"
            onClick={() => onApply(draft)}
          >
            {t('apply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ListSkeleton() {
  const t = useTranslations('issues.list');
  return (
    <div
      aria-busy="true"
      aria-label={t('loading')}
      className="flex flex-col gap-2.5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-25 w-full rounded-lg md:h-16" />
      ))}
    </div>
  );
}

function ListError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('issues.list');
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-destructive/40 p-6 text-center">
      <p role="alert" className="type-body text-destructive">
        {t('error')}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}

function EmptyState({
  filtered,
  onClearAll,
}: {
  filtered: boolean;
  onClearAll: () => void;
}) {
  const t = useTranslations('issues');
  return (
    <div
      data-testid="issues-empty"
      className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center"
    >
      <div className="h-3 w-24 rounded-sm hazard-stripe" aria-hidden />
      <h2 className="type-heading">{t('empty.title')}</h2>
      <p className="max-w-sm type-body text-muted-foreground">
        {filtered ? t('empty.filtered') : t('empty.none')}
      </p>
      {filtered && (
        <Button type="button" variant="outline" onClick={onClearAll}>
          {t('filters.clearAll')}
        </Button>
      )}
    </div>
  );
}
