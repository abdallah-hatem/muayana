'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * One request at a time for a button or form: `run` ignores calls while one is pending (a double
 * tap sends one request) and `pending` drives the busy state.
 */
export function usePendingAction() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      try {
        return await action();
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [],
  );
  return { pending, run };
}
