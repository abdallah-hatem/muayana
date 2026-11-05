import type { Issue } from '@muayana/shared';
import { clientFetch } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-result';
import type { QueueItem } from './db';
import { getItem, listItems, patchItem, removeItem, resetItem } from './queue';

/** Tries before an item is marked failed and kept (business §5.2). */
export const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

/** Wait after the n-th failed try: 5 s, 10 s, 20 s, … capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

function photoFile(item: QueueItem): File {
  const ext = item.photo.type === 'image/png' ? 'png' : 'jpg';
  return new File([item.photo.bytes], `${item.id}.${ext}`, {
    type: item.photo.type,
  });
}

/** Sends one item: `POST /issues` (idempotent on the phone-made id) or `POST /issues/:id/photos`. */
function upload(item: QueueItem): Promise<ApiResult<Issue>> {
  const body = new FormData();
  if (item.kind === 'create') {
    body.append('id', item.id);
    body.append('siteId', item.siteId);
    body.append('capturedAt', item.capturedAt);
    if (item.note) body.append('description', item.note);
    if (item.location) body.append('location', item.location);
    body.append('photo', photoFile(item));
    return clientFetch<Issue>('/issues', { method: 'POST', body });
  }
  body.append('kind', 'before');
  body.append('photo', photoFile(item));
  return clientFetch<Issue>(`/issues/${item.issueId}/photos`, {
    method: 'POST',
    body,
  });
}

type Outcome =
  | { type: 'done' }
  | { type: 'stop' }
  | { type: 'retry'; code: string }
  | { type: 'refused'; code: string };

/**
 * 200/201 → done (200 is the API answering an id it already has: the earlier upload landed but
 * its answer was lost). No network, a timeout, rate limit or a server error → try again later. A
 * 401 stops the run (the client is on its way to login). Any other refusal (409 ARCHIVED_SITE,
 * 404, 413, 400) will answer the same every time → failed with its reason, no retry.
 */
function outcomeOf(res: ApiResult<Issue>): Outcome {
  if (res.success) return { type: 'done' };
  if (res.status === 401) return { type: 'stop' };
  const code = res.error ?? `HTTP_${res.status}`;
  if (
    res.status === 0 ||
    res.status === 408 ||
    res.status === 429 ||
    res.status >= 500
  )
    return { type: 'retry', code };
  return { type: 'refused', code };
}

const isOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

/** One pass over the queue, oldest first. Stops at the first item that must wait, to keep order. */
async function runOnce(): Promise<void> {
  if (isOffline()) return;
  for (const listed of await listItems()) {
    // Re-read: the engineer may have discarded or retried it while earlier items uploaded.
    const item = await getItem(listed.id);
    if (!item || item.status !== 'pending') continue;
    if (item.nextAttemptAt > Date.now()) return;
    const outcome = outcomeOf(await upload(item));
    switch (outcome.type) {
      case 'done':
        await removeItem(item.id);
        break;
      case 'stop':
        return;
      case 'refused':
        await patchItem(item.id, {
          status: 'failed',
          attempts: item.attempts + 1,
          lastError: outcome.code,
        });
        break;
      case 'retry': {
        const attempts = item.attempts + 1;
        const exhausted = attempts >= MAX_ATTEMPTS;
        await patchItem(item.id, {
          attempts,
          lastError: outcome.code,
          status: exhausted ? 'failed' : 'pending',
          nextAttemptAt: exhausted ? 0 : Date.now() + backoffMs(attempts),
        });
        if (!exhausted) return;
        break;
      }
    }
  }
}

let running: Promise<void> | null = null;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let autoRetry = false;

/** Re-runs the sync when the earliest backoff ends (only while the sync worker is started). */
async function scheduleNext(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!autoRetry) return;
  const waits = (await listItems())
    .filter((i) => i.status === 'pending' && i.nextAttemptAt > Date.now())
    .map((i) => i.nextAttemptAt);
  if (waits.length === 0) return;
  timer = setTimeout(
    () => void syncQueue(),
    Math.min(...waits) - Date.now() + 50,
  );
}

/**
 * Uploads what is waiting, in order. One run at a time: a call during a run queues one more
 * pass after it (a capture while uploading still goes up).
 */
export function syncQueue(): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        rerun = false;
        await runOnce();
        await scheduleNext();
      } while (rerun);
    } finally {
      // Cleared in the same tick as the last `rerun` check, so no call falls in between.
      running = null;
    }
  })();
  return running;
}

/** Manual retry from the queue sheet: attempts reset, uploads now. */
export async function retryItem(id: string): Promise<void> {
  await resetItem(id);
  await syncQueue();
}

/**
 * The sync worker: runs now (app open), whenever the connection returns, and when a backoff
 * ends. Captures call `syncQueue()` themselves. Returns the stop function.
 */
export function startQueueSync(): () => void {
  autoRetry = true;
  const onOnline = () => void syncQueue();
  window.addEventListener('online', onOnline);
  void syncQueue();
  return () => {
    autoRetry = false;
    window.removeEventListener('online', onOnline);
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
