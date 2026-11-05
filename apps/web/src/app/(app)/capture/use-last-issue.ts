'use client';

import { useSyncExternalStore } from 'react';
import { capturePrefs, type LastIssue } from '@/lib/capture-prefs';

const listeners = new Set<() => void>();
/** Read from storage once; every write goes through `setLastIssue`, which keeps this current. */
let cached: { value: LastIssue | null } | null = null;

function snapshot(): LastIssue | null {
  cached ??= { value: capturePrefs.lastIssue() };
  return cached.value;
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The issue the next "add to previous" joins, remembered on the phone across reloads. */
export function setLastIssue(value: LastIssue): void {
  capturePrefs.setLastIssue(value);
  cached = { value };
  for (const notify of listeners) notify();
}

/** Read the current value outside render (the shot chain), always the latest write. */
export const currentLastIssue = snapshot;

export function useLastIssue(): LastIssue | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
