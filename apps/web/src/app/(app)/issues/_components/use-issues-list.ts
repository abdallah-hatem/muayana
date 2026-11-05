'use client';

import type { Issue, ParsedIssueFilter } from '@muayana/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import { filterToSearchParams } from '@/lib/issue-filter-url';

/** Issues per request: a phone screen and a bit, a desktop table page. */
export const ISSUES_PAGE_SIZE = 24;

/** `GET /issues` for the filter's query string, one page. */
export const issuesPath = (filterQuery: string, page: number) => {
  const params = new URLSearchParams(filterQuery);
  params.set('page', String(page));
  params.set('limit', String(ISSUES_PAGE_SIZE));
  return `/issues?${params.toString()}`;
};

type Loaded = {
  /** The filter (query string) these rows belong to. */
  key: string | null;
  issues: Issue[];
  total: number;
  page: number;
  hasMore: boolean;
  /** The filter whose last request failed. */
  errorKey: string | null;
  loadingMore: boolean;
};

const INITIAL: Loaded = {
  key: null,
  issues: [],
  total: 0,
  page: 0,
  hasMore: false,
  errorKey: null,
  loadingMore: false,
};

/**
 * The issues matching `filter`, page by page (infinite scroll). A new filter keeps the old rows
 * on screen, dimmed, until its first page lands; answers for an older filter are dropped.
 */
export function useIssuesList(filter: ParsedIssueFilter) {
  const key = filterToSearchParams(filter).toString();
  const [loaded, setLoaded] = useState<Loaded>(INITIAL);
  const generation = useRef(0);
  const inFlight = useRef(false);

  /** Starts a request; its answer is applied when it lands, unless a newer one went out. */
  const fetchPage = useCallback((filterKey: string, page: number) => {
    const mine = ++generation.current;
    inFlight.current = true;
    return clientFetch<Issue[]>(issuesPath(filterKey, page)).then((res) => {
      if (mine !== generation.current) return;
      inFlight.current = false;
      setLoaded((s) => applyPage(s, filterKey, page, res));
    });
  }, []);

  useEffect(() => {
    void fetchPage(key, 1);
  }, [key, fetchPage]);

  const current = loaded.key === key;
  const error = loaded.errorKey === key;

  const loadMore = useCallback(() => {
    if (inFlight.current || !current || !loaded.hasMore) return;
    setLoaded((s) => ({ ...s, loadingMore: true }));
    void fetchPage(key, loaded.page + 1);
  }, [current, fetchPage, key, loaded.hasMore, loaded.page]);

  const retry = useCallback(() => {
    setLoaded((s) => ({ ...s, errorKey: null }));
    void fetchPage(key, current ? loaded.page + 1 : 1);
  }, [current, fetchPage, key, loaded.page]);

  return {
    issues: loaded.issues,
    total: current ? loaded.total : null,
    /** Nothing to show yet for this filter. */
    loading: !current && !error && loaded.issues.length === 0,
    /** A new filter is loading over the previous rows. */
    refreshing: !current && !error && loaded.issues.length > 0,
    loadingMore: loaded.loadingMore,
    hasMore: current && loaded.hasMore,
    error,
    loadMore,
    retry,
  };
}

/** The list after one page's answer: replaced (page 1 / other filter), appended, or failed. */
function applyPage(
  s: Loaded,
  filterKey: string,
  page: number,
  res: ApiResult<Issue[]>,
): Loaded {
  if (!res.success) return { ...s, errorKey: filterKey, loadingMore: false };
  const rows = res.data ?? [];
  const issues =
    page === 1 || s.key !== filterKey ? rows : [...s.issues, ...rows];
  return {
    key: filterKey,
    issues,
    total: res.meta?.total ?? issues.length,
    page,
    hasMore: res.meta?.hasNextPage ?? false,
    errorKey: null,
    loadingMore: false,
  };
}
