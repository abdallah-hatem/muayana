'use client';

import type { Locale, ParsedIssueFilter } from '@muayana/shared';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { STATUS_TONE } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { categoryName } from '@/lib/format';
import { filterParts, type FilterPart } from '@/lib/issue-filter-url';
import { cn } from '@/lib/utils';
import type { FilterOptions } from './use-filter-options';

/** How a chip reads: the translated value, or the name of the site / category / worker. */
function useChipLabel(options: FilterOptions) {
  const t = useTranslations('issues.chip');
  const tStatus = useTranslations('common.status');
  const tPriority = useTranslations('common.priority');
  const locale = useLocale() as Locale;
  return (part: FilterPart): string => {
    switch (part.key) {
      case 'status':
        return tStatus(part.value);
      case 'priority':
        return tPriority(part.value);
      case 'siteId':
        return (
          options.sites.find((s) => s.id === part.value)?.name ?? t('unknown')
        );
      case 'categoryId': {
        const category = options.categories.find((c) => c.id === part.value);
        return category ? categoryName(category, locale) : t('unknown');
      }
      case 'workerId':
        return (
          options.workers.find((w) => w.id === part.value)?.name ?? t('unknown')
        );
      case 'overdue':
        return t('overdue');
      case 'q':
        return t('q', { q: part.value });
      default:
        return t(part.key, { date: part.value });
    }
  };
}

/** One removable chip per active filter value, and "clear all" once there are any. */
export function FilterChips({
  filter,
  options,
  onRemove,
  onClearAll,
}: {
  filter: ParsedIssueFilter;
  options: FilterOptions;
  onRemove: (part: FilterPart) => void;
  onClearAll: () => void;
}) {
  const t = useTranslations('issues.filters');
  const labelOf = useChipLabel(options);
  const parts = filterParts(filter);
  if (parts.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t('active')}
      className="flex flex-wrap items-center gap-2"
    >
      {parts.map((part) => {
        const label = labelOf(part);
        return (
          <button
            key={`${part.key}:${part.value}`}
            type="button"
            data-testid="filter-chip"
            aria-label={t('remove', { label })}
            onClick={() => onRemove(part)}
            className={cn(
              'inline-flex min-h-9 max-w-full press cursor-pointer items-center gap-1.5 rounded-sm px-2.5 type-micro font-bold',
              part.key === 'status'
                ? STATUS_TONE[part.value]
                : part.key === 'overdue'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-secondary text-secondary-foreground',
            )}
          >
            <span className="truncate">{label}</span>
            <X className="size-3.5 shrink-0" aria-hidden />
          </button>
        );
      })}
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={onClearAll}
        className="px-1 text-foreground underline"
      >
        {t('clearAll')}
      </Button>
    </div>
  );
}
