import { PHOTOS_PER_KIND_MAX } from '@muayana/shared';
import type { TrayPhoto } from '@/lib/offline-queue';

/**
 * The tray's selection (N6): photo ids in the order they were picked — the order they take in
 * the issue, shown as the numbered badges 1, 2, 3.
 */
export type TraySelection = readonly string[];

export type ToggleResult =
  | { selection: TraySelection; blocked: false }
  /** An issue takes at most 10 photos: an 11th is refused, the selection unchanged. */
  | { selection: TraySelection; blocked: true };

/** Tapping a photo: picks it last, or unpicks it (the ones after it move up a number). */
export function togglePick(
  selection: TraySelection,
  id: string,
  max: number = PHOTOS_PER_KIND_MAX,
): ToggleResult {
  if (selection.includes(id))
    return { selection: selection.filter((s) => s !== id), blocked: false };
  if (selection.length >= max) return { selection, blocked: true };
  return { selection: [...selection, id], blocked: false };
}

/** The badge number of a photo (1-based), or 0 when it is not picked. */
export const pickNumber = (selection: TraySelection, id: string): number =>
  selection.indexOf(id) + 1;

/** Drops picks whose photo has left the tray (made into an issue, deleted, other site). */
export function keepPresent(
  selection: TraySelection,
  photos: readonly TrayPhoto[],
): TraySelection {
  const present = new Set(photos.map((p) => p.id));
  const kept = selection.filter((id) => present.has(id));
  return kept.length === selection.length ? selection : kept;
}

export interface TrayGroup {
  /** The local day of the import (yyyy-mm-dd). */
  day: string;
  /** The latest import of that day (epoch ms), for "Today · 10:42". */
  latest: number;
  photos: TrayPhoto[];
}

const localDay = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The tray as the screen lists it: grouped by the day photos were imported, newest import first
 * (just-imported photos lead), and within one import the order the gallery handed them over.
 */
export function groupByImportDay(photos: readonly TrayPhoto[]): TrayGroup[] {
  const sorted = [...photos].sort(
    (a, b) => b.importedAt - a.importedAt || a.seq - b.seq,
  );
  const groups: TrayGroup[] = [];
  for (const photo of sorted) {
    const day = localDay(photo.importedAt);
    const group = groups.at(-1);
    if (group?.day === day) group.photos.push(photo);
    else groups.push({ day, latest: photo.importedAt, photos: [photo] });
  }
  return groups;
}

/** Whether `ms` falls on the same local day as `now`, the day before, or earlier. */
export function dayKind(
  ms: number,
  now: Date = new Date(),
): 'today' | 'yesterday' | 'earlier' {
  const day = localDay(ms);
  if (day === localDay(now.getTime())) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return day === localDay(yesterday.getTime()) ? 'yesterday' : 'earlier';
}
