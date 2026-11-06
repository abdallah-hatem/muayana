'use client';

import { useEffect, useState } from 'react';
import { useSiteSelection } from '@/components/site/site-context';
import { capturePrefs, type SiteOption } from '@/lib/capture-prefs';
import { listActiveSites } from '@/lib/issue-endpoints';

export type SitesState =
  | { phase: 'loading' }
  | { phase: 'ready'; sites: SiteOption[]; stale: boolean; failed: boolean };

/**
 * The sites the engineer can capture on, and the chosen one (the last used is preselected,
 * business §5.1). Fetched when online; the last list is kept on the phone so capture still works
 * with no signal (`stale`). A chosen site that is no longer active is dropped. The chosen site is
 * the app's one site selection, so the top-bar switcher and capture's own picker always agree.
 */
export function useCaptureSites() {
  const [state, setState] = useState<SitesState>({ phase: 'loading' });
  const { siteId, setSiteId } = useSiteSelection();

  useEffect(() => {
    let cancelled = false;
    const cached = capturePrefs.cachedSites();
    const last = capturePrefs.lastSiteId();

    const settle = (sites: SiteOption[], stale: boolean, failed: boolean) => {
      if (cancelled) return;
      const keep =
        last && sites.some((s) => s.id === last)
          ? last
          : sites.length === 1
            ? sites[0].id
            : null;
      setState({ phase: 'ready', sites, stale, failed });
      if (keep !== last) setSiteId(keep);
    };

    if (!navigator.onLine) {
      settle(cached ?? [], true, false);
      return;
    }
    // Aborted on unmount: leaving the screen must not leave its request holding a connection.
    const controller = new AbortController();
    listActiveSites(controller.signal)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const sites = res.data
            .filter((s) => !s.archived)
            .map(({ id, name }) => ({ id, name }));
          capturePrefs.setCachedSites(sites);
          settle(sites, false, false);
        } else {
          // Unreachable (status 0) is the offline list; any other answer is a failure.
          settle(cached ?? [], true, res.success || res.status !== 0);
        }
      })
      // Never stuck on "loading sites…": anything unexpected ends in the failed state.
      .catch(() => settle(cached ?? [], true, true));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [setSiteId]);

  const sites = state.phase === 'ready' ? state.sites : [];
  const site = sites.find((s) => s.id === siteId) ?? null;
  return { state, site, setSiteId };
}
