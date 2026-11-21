'use client';

import { useSyncExternalStore } from 'react';
import type { TrayPhoto } from '@/lib/offline-queue';
import { importingCount, listTray, onTrayChange } from './tray';

export interface TraySnapshot {
  /** Every tray photo on the phone, in import order; `null` until IndexedDB has answered once. */
  photos: TrayPhoto[] | null;
  /** Photos of a running import not stored yet. */
  importing: number;
}

const EMPTY: TraySnapshot = { photos: null, importing: 0 };
let snapshot: TraySnapshot = EMPTY;
const subscribers = new Set<() => void>();
let unwatch: (() => void) | null = null;
/** Object URLs of the thumbnails, made once per photo and revoked when it leaves the tray. */
const urls = new Map<string, string>();

function publish(photos: TrayPhoto[] | null): void {
  const present = new Set(photos?.map((p) => p.id));
  for (const [id, url] of urls)
    if (!present.has(id)) {
      URL.revokeObjectURL(url);
      urls.delete(id);
    }
  snapshot = { photos, importing: importingCount() };
  for (const notify of subscribers) notify();
}

function refresh(): void {
  listTray(null)
    .then(publish)
    // No IndexedDB (private mode on old Safari): an empty tray rather than a spinner forever.
    .catch(() => publish(snapshot.photos ?? []));
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (!unwatch) {
    unwatch = onTrayChange(refresh);
    refresh();
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      unwatch?.();
      unwatch = null;
    }
  };
}

/** The whole tray as React sees it; re-renders on every change. */
export function useTray(): TraySnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/** Narrows the tray to one site (`null`: "All sites", every photo). */
export function photosOfSite(
  photos: readonly TrayPhoto[],
  siteId: string | null,
): TrayPhoto[] {
  return siteId === null
    ? [...photos]
    : photos.filter((p) => p.siteId === siteId);
}

/** How many photos wait in this site's tray (`null`: all sites); 0 while loading. */
export function useTrayCount(siteId: string | null): number {
  const { photos } = useTray();
  return photos ? photosOfSite(photos, siteId).length : 0;
}

/** A thumbnail URL for a tray photo, kept while the photo is in the tray. */
export function trayPhotoUrl(photo: TrayPhoto): string {
  let url = urls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(
      new Blob([photo.photo.bytes], { type: photo.photo.type }),
    );
    urls.set(photo.id, url);
  }
  return url;
}

/** Tests: forget the cached snapshot (the next subscriber reads IndexedDB again). */
export function resetTraySnapshot(): void {
  snapshot = EMPTY;
  unwatch?.();
  unwatch = null;
  subscribers.clear();
}
