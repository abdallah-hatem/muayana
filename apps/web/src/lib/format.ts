import type { CategoryRef, Locale } from '@muayana/shared';

const counter = new Intl.NumberFormat('en-US');

/**
 * A count as people read it: grouped (`1,284`), Latin digits in both languages (the stencil mono
 * face sets numbers in Latin, docs/DESIGN.md).
 */
export const formatCount = (value: number): string => counter.format(value);

/** A category's name in the app's language (English falls back to the Arabic name). */
export const categoryName = (
  category: Pick<CategoryRef, 'nameAr' | 'nameEn'>,
  locale: Locale,
): string =>
  locale === 'en' && category.nameEn ? category.nameEn : category.nameAr;
