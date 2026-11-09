'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  canShareFiles,
  loadIssuePhotos,
  type IssuePhotos,
} from '@/lib/whatsapp-share';

/**
 * Where the photos of a send stand. `idle`: nothing downloaded yet; `loading`: `done` of `total`
 * photos settled; `ready`: the share can go out straight from the next tap.
 */
export interface PhotoPreparation {
  status: 'idle' | 'loading' | 'ready';
  done: number;
  total: number;
  start: () => void;
  cancel: () => void;
}

type Loaded<I extends { number: number }> = {
  key: string;
  status: 'loading' | 'ready';
  done: number;
  items: IssuePhotos<I>[] | null;
};

const noSubscribe = () => () => {};

/**
 * The issues' photos as files, downloaded only when the engineer asks for them (`start`) — never
 * on page open, so a contractor page with 200 issues costs no mobile data until he sends (§5.5).
 * Once `ready`, `items` is there synchronously, so the share keeps the tap's user activation.
 * Nothing to prepare (the browser can't share files, or there are no photos) → `ready` at once,
 * with `items` null where files can't be shared (the wa.me link carries the photos then).
 * New issues or photos (`key`) start over and stop any download in flight; so does `cancel`.
 */
export function usePreparedPhotos<I extends { id: string; number: number }>(
  issues: readonly I[],
  urlsOf: (issue: I) => string[],
): { preparation: PhotoPreparation; items: IssuePhotos<I>[] | null } {
  const canFiles = useSyncExternalStore(
    noSubscribe,
    canShareFiles,
    () => false,
  );
  const key = issues.map((i) => `${i.id}:${urlsOf(i).join(',')}`).join('|');
  const total = canFiles
    ? issues.reduce((sum, i) => sum + urlsOf(i).length, 0)
    : 0;
  const [loaded, setLoaded] = useState<Loaded<I> | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Different issues or photos, or leaving the page: stop downloading the old ones.
  useEffect(() => {
    const ref = controller;
    return () => {
      ref.current?.abort();
      ref.current = null;
    };
  }, [key]);

  const current = loaded?.key === key ? loaded : null;
  const needsPreparing = total > 0;
  const status = needsPreparing ? (current?.status ?? 'idle') : 'ready';

  function start() {
    if (status !== 'idle') return;
    const ac = new AbortController();
    controller.current = ac;
    const list = issues;
    setLoaded({ key, status: 'loading', done: 0, items: null });
    const onPhoto = () => {
      if (ac.signal.aborted) return;
      setLoaded((s) =>
        s?.key === key && s.status === 'loading'
          ? { ...s, done: s.done + 1 }
          : s,
      );
    };
    void Promise.all(
      list.map((issue) =>
        loadIssuePhotos(issue, urlsOf(issue), { signal: ac.signal, onPhoto }),
      ),
    ).then((items) => {
      if (ac.signal.aborted) return;
      controller.current = null;
      setLoaded({ key, status: 'ready', done: total, items });
    });
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setLoaded(null);
  }

  const items = !canFiles
    ? null
    : needsPreparing
      ? (current?.items ?? null)
      : issues.map((issue) => ({ issue, files: [], missing: false }));

  return {
    preparation: {
      status,
      done: current?.done ?? 0,
      total,
      start,
      cancel,
    },
    items,
  };
}
