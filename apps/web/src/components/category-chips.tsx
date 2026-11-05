'use client';

import { useLocale } from 'next-intl';
import type { CategoryRef } from '@muayana/shared';
import { categoryName } from '@/lib/category-name';
import { cn } from '@/lib/utils';

/**
 * Categories as big tappable chips with their colour dot (the sort inbox's main decision). One
 * pick at a time; tapping the chosen chip again keeps it.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  disabled = false,
  labelledBy,
}: {
  categories: readonly CategoryRef[];
  value: string | null;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const locale = useLocale();
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {categories.map((category) => {
        const chosen = category.id === value;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={chosen}
            disabled={disabled}
            onClick={() => onChange(category.id)}
            className={cn(
              'inline-flex h-11 max-w-full min-w-0 press cursor-pointer items-center gap-2 rounded-md border-2 px-3 type-small font-bold',
              'disabled:cursor-not-allowed disabled:opacity-50',
              chosen
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden
            />
            <span className="truncate">{categoryName(category, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}
