import type { CategoryRef, Locale } from '@muayana/shared';

/** A category's name in the UI language: English when it has one and the UI is English. */
export const categoryName = (
  category: Pick<CategoryRef, 'nameAr' | 'nameEn'>,
  locale: Locale | string,
): string =>
  locale === 'en' && category.nameEn?.trim()
    ? category.nameEn
    : category.nameAr;
