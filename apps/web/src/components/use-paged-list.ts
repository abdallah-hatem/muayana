'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiResult } from '@/lib/api-result';
import { DEFAULT_PAGE_SIZE } from './list-pager';

/** One page; `signal` aborts it when the list unmounts or asks for another page. */
type FetchPage<T> = (
  page: number,
  limit: number,
  signal: AbortSignal,
) => Promise<ApiResult<T[]>>;

interface Request<T> {
  fetchPage: FetchPage<T>;
  page: number;
  limit: number;
  version: number;
}

type Loaded<T> =
  | { status: 'error'; request: Request<T> }
  | { status: 'ready'; request: Request<T>; items: T[]; total: number };

/**
 * A paginated list from the API. A new `fetchPage` (the filter changed) goes back to page 1.
 * While the next page or filter loads, the current rows stay (`refreshing`) so nothing jumps.
 */
export function usePagedList<T>(fetchPage: FetchPage<T>) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [lastFetch, setLastFetch] = useState<FetchPage<T>>(() => fetchPage);

  // The filter changed: back to the first page (adjusting state during render, not in an effect).
  if (lastFetch !== fetchPage) {
    setLastFetch(() => fetchPage);
    setPage(1);
  }

  useEffect(() => {
    let live = true;
    // Leaving the screen must not leave its request holding a connection the next page needs.
    const controller = new AbortController();
    const request = { fetchPage, page, limit, version };
    void fetchPage(page, limit, controller.signal).then((res) => {
      if (!live) return;
      if (!res.success) return setLoaded({ status: 'error', request });
      // The last row of a later page went away: show the page before it.
      if (res.data.length === 0 && page > 1) return setPage(page - 1);
      setLoaded({
        status: 'ready',
        request,
        items: res.data,
        total: res.meta?.total ?? res.data.length,
      });
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [fetchPage, page, limit, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = loaded?.request;
  const refreshing =
    !current ||
    current.fetchPage !== fetchPage ||
    current.page !== page ||
    current.limit !== limit ||
    current.version !== version;

  return {
    page,
    limit,
    setPage,
    setLimit: (next: number) => {
      setLimit(next);
      setPage(1);
    },
    reload,
    refreshing,
    /** `loading` only before anything has loaded. */
    status: loaded?.status ?? ('loading' as const),
    items: loaded?.status === 'ready' ? loaded.items : [],
    total: loaded?.status === 'ready' ? loaded.total : 0,
  };
}
