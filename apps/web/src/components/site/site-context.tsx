'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { readLastSiteId, writeLastSiteId } from '@/lib/last-site';

interface SiteSelection {
  /** The chosen site, or `null` for all sites. */
  siteId: string | null;
  setSiteId: (siteId: string | null) => void;
  /** False until the remembered site has been read (avoid fetching "all sites" first). */
  ready: boolean;
}

const SiteContext = createContext<SiteSelection>({
  siteId: null,
  setSiteId: () => undefined,
  ready: true,
});

/**
 * The site the screens work on, chosen in the top bar and remembered on this phone (business
 * §5.1). Capture, the inbox and the lists read it with `useSiteSelection()`.
 */
export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [siteId, setState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage exists only in the browser: read it after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from browser storage
    setState(readLastSiteId());
    setReady(true);
  }, []);

  const setSiteId = useCallback((next: string | null) => {
    writeLastSiteId(next);
    setState(next);
  }, []);

  const value = useMemo(
    () => ({ siteId, setSiteId, ready }),
    [siteId, setSiteId, ready],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSiteSelection = (): SiteSelection => useContext(SiteContext);
