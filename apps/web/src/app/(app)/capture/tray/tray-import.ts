'use client';

import { useSyncExternalStore } from 'react';
import { addToTray, isQuotaError, type ImportResult } from '@/lib/photo-tray';

/** How the last gallery import into the tray ended, for the tray screen to say (N6). */
export type ImportNotice =
  | ({ kind: 'done' } & ImportResult)
  /** Nothing could be stored (no IndexedDB, or full before the first photo). */
  | { kind: 'failed'; full: boolean };

let notice: ImportNotice | null = null;
const listeners = new Set<() => void>();

function setNotice(next: ImportNotice | null): void {
  notice = next;
  for (const notify of listeners) notify();
}

/**
 * Gallery photos into the tray (business §5.1 step 5): runs on its own, so the screen that picked
 * them can open the tray at once and the photos appear there as they are stored.
 */
export function importToTray(
  files: File[],
  siteId: string | null,
): Promise<void> {
  setNotice(null);
  return addToTray(files, siteId)
    .then((result) => setNotice({ kind: 'done', ...result }))
    .catch((error: unknown) =>
      setNotice({ kind: 'failed', full: isQuotaError(error) }),
    );
}

export const clearImportNotice = (): void => setNotice(null);

/** The last import's outcome while it is worth saying (left out photos, storage full). */
export function useImportNotice(): ImportNotice | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => notice,
    () => null,
  );
}
