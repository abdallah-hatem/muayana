'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** Up to five page numbers around the current one. */
function pageWindow(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * A managed list's pagination, always shown: "Showing 1–10 of 14", first / previous / page numbers /
 * next / last, and the page size.
 */
export function ListPager({
  page,
  limit,
  total,
  disabled = false,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const t = useTranslations('common.pager');
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const go = (next: number) => {
    if (!disabled && next >= 1 && next <= pages && next !== page)
      onPageChange(next);
  };

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <p className="type-small text-muted-foreground">
        {t('summary', { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('first')}
          disabled={disabled || page <= 1}
          onClick={() => go(1)}
        >
          <ChevronsLeft className="flip-rtl" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('previous')}
          disabled={disabled || page <= 1}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft className="flip-rtl" aria-hidden />
        </Button>
        {pageWindow(page, pages).map((n) => (
          <Button
            key={n}
            type="button"
            variant={n === page ? 'default' : 'ghost'}
            size="icon-sm"
            aria-label={t('page', { page: n })}
            aria-current={n === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => go(n)}
            className={cn('font-mono', n === page && 'shadow-none')}
          >
            {n}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('next')}
          disabled={disabled || page >= pages}
          onClick={() => go(page + 1)}
        >
          <ChevronRight className="flip-rtl" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('last')}
          disabled={disabled || page >= pages}
          onClick={() => go(pages)}
        >
          <ChevronsRight className="flip-rtl" aria-hidden />
        </Button>
        <Select
          value={String(limit)}
          onValueChange={(v) => onLimitChange(Number(v))}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={t('pageSize')}
            className="ms-2 h-10 w-auto min-w-20"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t('perPage', { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
