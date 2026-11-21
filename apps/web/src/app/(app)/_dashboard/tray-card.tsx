'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/format';
import { useTrayCount } from '@/lib/photo-tray';
import { ROUTES } from '@/lib/routes';

/**
 * Photos waiting in the unsorted tray on this phone (N6), framed like the sort inbox card, with
 * the way into the tray. Shown only while there are some (the chosen site's, or every site's).
 */
export function TrayCard({ siteId }: { siteId: string | null }) {
  const t = useTranslations('tray.card');
  const count = useTrayCount(siteId);
  if (count === 0) return null;
  return (
    <div className="rounded-lg hazard-stripe p-1" data-testid="tray-card">
      <div className="flex items-center justify-between gap-3 rounded-md bg-hazard-b p-4 text-background dark:text-foreground">
        <div className="flex min-w-0 flex-col">
          <span className="type-small font-bold text-hazard-a">
            {t('title')}
          </span>
          <span
            className="type-stencil type-display"
            data-testid="tray-card-count"
          >
            {formatCount(count)}
          </span>
        </div>
        <Button asChild>
          <Link href={ROUTES.captureTray} data-testid="tray-card-open">
            {t('open')}
            <ArrowRight className="flip-rtl" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
