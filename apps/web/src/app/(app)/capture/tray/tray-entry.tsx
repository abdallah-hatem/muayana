'use client';

import { ChevronRight, Images } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSiteSelection } from '@/components/site/site-context';
import { formatCount } from '@/lib/format';
import { useTrayCount } from '@/lib/photo-tray';
import { ROUTES } from '@/lib/routes';

/**
 * The way from the camera to the unsorted tray (N6): «صور غير مرتبة · N», N being the chosen
 * site's tray (every site's on "All sites"). Always there, so the tray can be found before it
 * holds anything.
 */
export function TrayEntry() {
  const t = useTranslations('tray');
  const { siteId } = useSiteSelection();
  const count = useTrayCount(siteId);
  return (
    <Link
      href={ROUTES.captureTray}
      aria-label={t('entryLabel', { count })}
      data-testid="tray-entry"
      className="inline-flex h-11 min-w-0 press cursor-pointer items-center gap-2 rounded-sm border-2 border-border bg-card ps-2.5 pe-1.5 type-small font-bold hover:bg-accent"
    >
      <Images className="size-5 shrink-0" aria-hidden />
      <span className="truncate">{t('entry')}</span>
      {count > 0 && (
        <span
          data-testid="tray-entry-count"
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 type-stencil text-xs text-destructive-foreground"
        >
          {formatCount(count)}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 flip-rtl" aria-hidden />
    </Link>
  );
}
