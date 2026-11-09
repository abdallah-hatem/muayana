'use client';

import { useEffect, useState } from 'react';
import type { CategoryRef } from '@muayana/shared';
import { capturePrefs, type CaptureWorker } from '@/lib/capture-prefs';
import { listActiveCategories, listActiveWorkers } from '@/lib/issue-endpoints';

export interface CaptureLookups {
  phase: 'loading' | 'ready';
  categories: CategoryRef[];
  workers: CaptureWorker[];
  /** The lists are the ones the phone saw last (offline or unreachable): "may be out of date". */
  stale: boolean;
}

const LOADING: CaptureLookups = {
  phase: 'loading',
  categories: [],
  workers: [],
  stale: false,
};

/**
 * The trades and contractors the capture sheet offers (business §5.1–5.2): fetched when online
 * and kept on the phone, so the sheet still works with no signal from the last lists seen
 * (`stale`). The server checks every rule again at upload.
 */
export function useCaptureLookups(): CaptureLookups {
  const [state, setState] = useState<CaptureLookups>(LOADING);

  useEffect(() => {
    let cancelled = false;
    const fromCache = (): CaptureLookups => ({
      phase: 'ready',
      categories: capturePrefs.cachedCategories() ?? [],
      workers: capturePrefs.cachedWorkers() ?? [],
      stale: true,
    });
    const settle = (next: CaptureLookups) => {
      if (!cancelled) setState(next);
    };

    if (!navigator.onLine) {
      settle(fromCache());
      return;
    }
    // Aborted on unmount: leaving the screen must not leave its requests holding connections.
    const controller = new AbortController();
    Promise.all([
      listActiveCategories(controller.signal),
      listActiveWorkers(controller.signal),
    ])
      .then(([categories, workers]) => {
        if (
          !categories.success ||
          !workers.success ||
          !Array.isArray(categories.data) ||
          !Array.isArray(workers.data)
        ) {
          settle(fromCache());
          return;
        }
        const active = workers.data.filter((w) => w.active);
        capturePrefs.setCachedCategories(categories.data);
        capturePrefs.setCachedWorkers(active);
        settle({
          phase: 'ready',
          categories: categories.data,
          workers: active,
          stale: false,
        });
      })
      .catch(() => settle(fromCache()));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
}
