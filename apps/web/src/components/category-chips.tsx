'use client';

import { useLocale } from 'next-intl';
import type { CategoryRef } from '@muayana/shared';
import { categoryName } from '@/lib/category-name';
import { cn } from '@/lib/utils';

/**
 * One category as a big tappable chip with its colour dot (`category` null: a plain chip such as
 * "All", labelled by `children`). `pressed` fills it in ink.
 */
export function CategoryChip({
  category,
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  category: Pick<CategoryRef, 'nameAr' | 'nameEn' | 'color'> | null;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 max-w-full min-w-0 shrink-0 press cursor-pointer items-center gap-2 rounded-md border-2 px-3 type-small font-bold',
        'disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card hover:bg-accent',
      )}
    >
      {category && (
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
      )}
      <span className="truncate">
        {category ? categoryName(category, locale) : null}
        {children}
      </span>
    </button>
  );
}

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
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-2"
    >
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          category={category}
          pressed={category.id === value}
          disabled={disabled}
          onClick={() => onChange(category.id)}
        />
      ))}
    </div>
  );
}
