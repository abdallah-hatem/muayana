'use client';

import { Building2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { SitesState } from './use-capture-sites';

/** The site the next photos go to: a bottom sheet of active sites, big rows, one tap. */
export function SitePicker({
  open,
  onOpenChange,
  state,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: SitesState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('capture');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[calc(100dvh-2rem)]">
        <DrawerHeader>
          <DrawerTitle className="type-heading">{t('site.title')}</DrawerTitle>
          <DrawerDescription className="type-small">
            {t('site.description')}
          </DrawerDescription>
        </DrawerHeader>
        {state.phase === 'ready' && state.stale && state.sites.length > 0 && (
          <p className="mx-4 mb-2 type-small text-muted-foreground">
            {state.failed ? t('errors.SITES_FAILED') : t('site.offlineList')}
          </p>
        )}
        <ul className="flex scrollbar-clean min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-6">
          {state.phase === 'loading' &&
            [0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-14 w-full rounded-lg" />
              </li>
            ))}
          {state.phase === 'ready' && state.sites.length === 0 && (
            <li className="py-8 text-center type-body text-muted-foreground">
              {state.failed ? t('errors.SITES_FAILED') : t('site.none')}
            </li>
          )}
          {state.phase === 'ready' &&
            state.sites.map((site) => {
              const selected = site.id === selectedId;
              return (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(site.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex min-h-14 w-full press cursor-pointer items-center gap-3 rounded-lg border-2 px-4 text-start type-body font-bold',
                      selected
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <Building2 className="size-5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 break-words">
                      {site.name}
                    </span>
                    {selected && (
                      <Check className="size-5 shrink-0" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
