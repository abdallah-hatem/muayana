'use client';

import { useSyncExternalStore } from 'react';
import type { QueueItem } from './db';
import { listItems, onQueueChange } from './queue';

/** The queue as React sees it: `null` until IndexedDB has answered once. */
let snapshot: QueueItem[] | null = null;
const subscribers = new Set<() => void>();
let unwatch: (() => void) | null = null;

function refresh(): void {
  listItems()
    .then((items) => {
      snapshot = items;
      for (const notify of subscribers) notify();
    })
    // No IndexedDB (private mode on old Safari): show an empty queue rather than nothing.
    .catch(() => {
      snapshot ??= [];
      for (const notify of subscribers) notify();
    });
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (!unwatch) {
    unwatch = onQueueChange(refresh);
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

/** Every queued item in upload order (null while loading). Re-renders on every queue change. */
export function useQueueItems(): QueueItem[] | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );
}

/** How many items wait on the phone (pending + failed); 0 while loading. */
export function useQueueCount(): number {
  return useQueueItems()?.length ?? 0;
}
