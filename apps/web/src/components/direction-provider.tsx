'use client';

import { useLocale } from 'next-intl';
import { Direction } from 'radix-ui';
import { directionOf } from '@muayana/shared';
import { isLocale } from '@/i18n/config';

/**
 * Radix reads reading direction from its own context, not from `<html dir>`: without this,
 * Select, DropdownMenu, Popover and Tabs lay out and navigate left-to-right in Arabic. Mount it
 * inside the intl provider so it follows the active locale.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const raw = useLocale();
  const dir = directionOf(isLocale(raw) ? raw : 'ar');
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
