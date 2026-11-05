import { newUuid } from '@/lib/uuid';
import { queueDb, type QueueItem, type QueueKind } from './db';

export interface EnqueueInput {
  kind: QueueKind;
  /** Required for `addPhoto` (the earlier issue); ignored for `create`, whose id is the issue id. */
  issueId?: string;
  siteId: string;
  capturedAt: string;
  note?: string | null;
  location?: string | null;
  photo: Blob;
}

const listeners = new Set<() => void>();

/** Called after every change to the queue (badge, sheet). Returns the unsubscribe. */
export function onQueueChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

const blank = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Stores a captured photo on the phone. Answers the stored item (its id is the issue id for `create`). */
export async function enqueue(input: EnqueueInput): Promise<QueueItem> {
  if (input.kind === 'addPhoto' && !input.issueId)
    throw new Error('addPhoto needs the issue id');
  const bytes = await input.photo.arrayBuffer();
  const db = await queueDb();
  const tx = db.transaction('queue', 'readwrite');
  const last = await tx.store.index('bySeq').openCursor(null, 'prev');
  const id = newUuid();
  const item: QueueItem = {
    id,
    kind: input.kind,
    issueId: input.kind === 'create' ? id : input.issueId!,
    siteId: input.siteId,
    capturedAt: input.capturedAt,
    note: blank(input.note),
    location: blank(input.location),
    photo: { bytes, type: input.photo.type || 'image/jpeg' },
    attempts: 0,
    status: 'pending',
    lastError: null,
    seq: (last?.value.seq ?? 0) + 1,
    nextAttemptAt: 0,
  };
  await tx.store.add(item);
  await tx.done;
  emitChange();
  return item;
}

/** Every item, in upload order. */
export async function listItems(): Promise<QueueItem[]> {
  return (await queueDb()).getAllFromIndex('queue', 'bySeq');
}

export async function getItem(id: string): Promise<QueueItem | undefined> {
  return (await queueDb()).get('queue', id);
}

/** Uploaded: the item leaves the phone. */
export async function removeItem(id: string): Promise<void> {
  await (await queueDb()).delete('queue', id);
  emitChange();
}

/** Applies `patch` to an item still in the queue (no-op if it was discarded meanwhile). */
export async function patchItem(
  id: string,
  patch: Partial<Omit<QueueItem, 'id'>>,
): Promise<void> {
  const db = await queueDb();
  const tx = db.transaction('queue', 'readwrite');
  const item = await tx.store.get(id);
  if (item) await tx.store.put({ ...item, ...patch });
  await tx.done;
  if (item) emitChange();
}

/**
 * The engineer throws an item away, photo included. Discarding a new issue also drops the photos
 * queued to join it: that issue will never exist.
 */
export async function discardItem(id: string): Promise<void> {
  const db = await queueDb();
  const tx = db.transaction('queue', 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    await tx.store.delete(id);
    if (item.kind === 'create') {
      let cursor = await tx.store.openCursor();
      while (cursor) {
        if (cursor.value.kind === 'addPhoto' && cursor.value.issueId === id)
          await cursor.delete();
        cursor = await cursor.continue();
      }
    }
  }
  await tx.done;
  emitChange();
}

/** Manual retry: a fresh start (attempts reset, no backoff). The caller then runs the sync. */
export async function resetItem(id: string): Promise<void> {
  await patchItem(id, {
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
  });
}
