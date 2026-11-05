'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether `query` (a CSS media query) matches, live. The server render answers `serverValue`.
 * For layout use CSS; this is for the few props that need a number (e.g. a popover's padding).
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Below `md` the phone's bottom nav (with its raised shutter) covers the screen's bottom edge. */
export const BOTTOM_NAV_QUERY = '(max-width: 47.99rem)';
