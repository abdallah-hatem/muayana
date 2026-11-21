'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { LocalPhoto } from '@/components/photo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { TrayPhoto } from '@/lib/offline-queue';
import {
  dayKind,
  pickNumber,
  trayPhotoUrl,
  type TrayGroup,
  type TraySelection,
} from '@/lib/photo-tray';
import { cn } from '@/lib/utils';

const GRID = 'grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5';

/** The dashed first tile: more photos from the gallery into this tray. */
export function ImportTile({ onImport }: { onImport: () => void }) {
  const t = useTranslations('tray');
  return (
    <button
      type="button"
      onClick={onImport}
      aria-label={t('importLabel')}
      data-testid="tray-import"
      className="flex aspect-square w-full press cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-foreground/40 bg-card p-2 text-center type-micro font-bold hover:bg-accent"
    >
      <ImagePlus className="size-7" aria-hidden />
      {t('import')}
    </button>
  );
}

/**
 * One photo of the tray. Picked: a yellow ring and its pick number (the order it takes in the
 * issue); not picked: an empty circle where the number would go.
 */
function PhotoTile({
  photo,
  number,
  pick,
  onToggle,
}: {
  photo: TrayPhoto;
  /** Its place on screen (1-based), for the label. */
  number: number;
  /** 0 when not picked. */
  pick: number;
  onToggle: () => void;
}) {
  const t = useTranslations('tray');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pick > 0}
      aria-label={
        pick > 0 ? t('photoPicked', { number, pick }) : t('photo', { number })
      }
      data-testid="tray-photo"
      data-pick={pick || undefined}
      className="relative block aspect-square w-full press cursor-pointer overflow-hidden rounded-md bg-muted"
    >
      <LocalPhoto
        src={trayPhotoUrl(photo)}
        alt=""
        aria-hidden
        className="size-full object-cover text-transparent"
      />
      {pick > 0 ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md ring-4 ring-primary ring-inset"
          />
          <span
            aria-hidden
            data-testid="tray-pick-badge"
            className="absolute start-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-primary type-stencil text-sm text-primary-foreground shadow-card"
          >
            {pick}
          </span>
        </>
      ) : (
        <span
          aria-hidden
          className="absolute start-1.5 top-1.5 size-7 rounded-full border-2 border-background bg-hazard-b/30 dark:border-foreground"
        />
      )}
    </button>
  );
}

/** "Today · 10:42", "Yesterday", or the date: when the photos of a group were imported. */
function GroupLabel({ group }: { group: TrayGroup }) {
  const t = useTranslations('tray');
  const format = useFormatter();
  const when = new Date(group.latest);
  const kind = dayKind(group.latest);
  if (kind === 'today')
    return (
      <>
        {t('today', {
          time: format.dateTime(when, { hour: 'numeric', minute: '2-digit' }),
        })}
      </>
    );
  if (kind === 'yesterday') return <>{t('yesterday')}</>;
  return (
    <>
      {format.dateTime(when, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
    </>
  );
}

/**
 * The tray's photos by import day (newest first), three to a row on the phone. The import tile
 * leads the first group, followed by a placeholder per photo still being stored.
 */
export function TrayGrid({
  groups,
  importing,
  selection,
  onImport,
  onToggle,
}: {
  groups: TrayGroup[];
  importing: number;
  selection: TraySelection;
  onImport: () => void;
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('tray');
  const leadIsToday =
    groups.length > 0 && dayKind(groups[0].latest) === 'today';
  const placeholders = Array.from({ length: importing }, (_, i) => (
    <li key={`importing-${i}`}>
      <Skeleton
        data-testid="tray-placeholder"
        className="aspect-square w-full rounded-md"
      />
    </li>
  ));
  // A new import with no group of today yet: its tiles get a row of their own on top.
  const ownLead = groups.length === 0 || (importing > 0 && !leadIsToday);
  // Where each group starts in the screen's numbering ("Photo 7").
  const starts = groups.map((_, i) =>
    groups.slice(0, i).reduce((sum, g) => sum + g.photos.length, 0),
  );

  return (
    <div className="flex flex-col gap-5">
      {ownLead && (
        <ul className={GRID}>
          <li>
            <ImportTile onImport={onImport} />
          </li>
          {placeholders}
        </ul>
      )}
      {groups.map((group, index) => (
        <section
          key={group.day}
          aria-labelledby={`tray-group-${group.day}`}
          data-testid="tray-group"
          className="flex flex-col gap-2"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`tray-group-${group.day}`} className="type-small font-bold">
              <GroupLabel group={group} />
            </h2>
            <span className="shrink-0 type-micro text-muted-foreground">
              {t('groupCount', { count: group.photos.length })}
            </span>
          </div>
          <ul className={GRID}>
            {index === 0 && !ownLead && (
              <>
                <li>
                  <ImportTile onImport={onImport} />
                </li>
                {placeholders}
              </>
            )}
            {group.photos.map((photo, at) => (
              <li key={photo.id}>
                <PhotoTile
                  photo={photo}
                  number={starts[index] + at + 1}
                  pick={pickNumber(selection, photo.id)}
                  onToggle={() => onToggle(photo.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** While photos are picked: how many, delete them, or make one issue of them (over the nav). */
export function TrayActions({
  count,
  onDelete,
  onCreate,
}: {
  count: number;
  onDelete: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations('tray');
  return (
    <div className="fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6 md:ps-30 md:pe-6">
      <div
        data-testid="tray-actions"
        className="mx-auto flex max-w-3xl flex-col gap-2 rounded-lg bg-hazard-b p-3 text-background shadow-float dark:border-2 dark:border-border dark:text-foreground"
      >
        <div className="flex items-center justify-between gap-3">
          <p
            aria-live="polite"
            data-testid="tray-selected"
            className="ps-1 type-small font-bold"
          >
            {t('selected', { count })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            data-testid="tray-delete"
            className="text-hazard-a hover:bg-background/10 hover:text-hazard-a dark:hover:bg-foreground/10"
          >
            <Trash2 aria-hidden />
            {t('delete')}
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={onCreate}
          data-testid="tray-create"
          className="w-full"
        >
          {t('create', { count })}
        </Button>
      </div>
    </div>
  );
}

/** The tray before IndexedDB has answered. */
export function TraySkeleton() {
  return (
    <ul className={cn(GRID, 'mt-8')} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full rounded-md" />
        </li>
      ))}
    </ul>
  );
}
