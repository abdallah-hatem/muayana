'use client';

import { useEffect } from 'react';
import { startQueueSync } from '@/lib/offline-queue';

/**
 * Mounted once in the signed-in shell: starts the upload worker (app open, back online, after a
 * backoff) and registers the service worker that keeps /capture launchable offline. The service
 * worker is production-only: in dev it would cache hot-reloaded chunks.
 */
export function QueueSync() {
  useEffect(() => startQueueSync(), []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Hand the worker the chunks this page loaded, so the shell starts offline next time.
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => new URL(url).pathname.startsWith('/_next/static/'));
        registration.active?.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(() => {
        // No service worker (private mode, old browser): the app still works online.
      });
  }, []);

  return null;
}
