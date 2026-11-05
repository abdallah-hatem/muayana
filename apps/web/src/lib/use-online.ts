'use client';

import { useCallback, useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

/**
 * Whether the phone has a connection (`navigator.onLine`), live. The server render assumes
 * online. Only capture works offline (business §5.2): every other action that sends a request
 * checks this — see `useNeedsConnection`.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The "needs connection" guard for sort / assign / export and every other online-only action.
 * `guard(action)` runs the action when online; offline it sends nothing and calls `onBlocked`
 * (show the translated `capture.needsConnection` message there). `online` drives the disabled
 * state and the hint.
 */
export function useNeedsConnection(onBlocked: () => void): {
  online: boolean;
  guard: <A extends unknown[]>(
    action: (...args: A) => unknown,
  ) => (...args: A) => void;
} {
  const online = useOnline();
  const guard = useCallback(
    <A extends unknown[]>(action: (...args: A) => unknown) =>
      (...args: A) => {
        if (!navigator.onLine) {
          onBlocked();
          return;
        }
        void action(...args);
      },
    [onBlocked],
  );
  return { online, guard };
}
