import { newUuid } from '@/lib/uuid';
import type { Priority } from '@muayana/shared';
import { queueDb, type QueueItem, type QueueKind } from './db';

export interface EnqueueInput {
  kind: QueueKind;
  /** Required for `addPhoto` (the earlier issue); ignored for `create`, whose id is the issue id. */
  issueId?: string;
  siteId: string;
  capturedAt: string;
  note?: string | null;
  location?: string | null;
  categoryId?: string | null;
  workerId?: string | null;
  priority?: Priority | null;
  photo: Blob;
  /** `draft` while the capture sheet is open: kept, not uploaded (see QueueStatus). */
  draft?: boolean;
}

/** The capture sheet's fields, saved onto a drafted `create` item (§5.1). */
export interface CaptureDetails {
  note?: string | null;
  location?: string | null;
  categoryId?: string | null;
  workerId?: string | null;
  priority?: Priority | null;
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
    categoryId: input.categoryId ?? null,
    workerId: input.workerId ?? null,
    priority: input.priority ?? null,
    photo: { bytes, type: input.photo.type || 'image/jpeg' },
    attempts: 0,
    status: input.draft ? 'draft' : 'pending',
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

/**
 * The capture sheet is saved: the drafted new issue takes the sheet's fields, and it and the
 * photos drafted for it become uploads, in the order they were taken.
 */
export async function commitDraft(
  issueId: string,
  details: CaptureDetails = {},
): Promise<void> {
  const db = await queueDb();
  const tx = db.transaction('queue', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const item = cursor.value;
    if (item.status === 'draft' && item.issueId === issueId) {
      await cursor.update(
        item.kind === 'create'
          ? {
              ...item,
              status: 'pending',
              note: blank(details.note),
              location: blank(details.location),
              categoryId: details.categoryId ?? null,
              workerId: details.workerId ?? null,
              priority: details.priority ?? null,
            }
          : { ...item, status: 'pending' },
      );
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  emitChange();
}

/**
 * Drafts left behind by an app closed with the capture sheet open become photo-only uploads, so
 * the photos are never lost (§5.1). Called when the sync starts, before any sheet can be open.
 */
export async function promoteDrafts(): Promise<void> {
  const db = await queueDb();
  const tx = db.transaction('queue', 'readwrite');
  let promoted = false;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.status === 'draft') {
      await cursor.update({ ...cursor.value, status: 'pending' });
      promoted = true;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  if (promoted) emitChange();
}

/**
 * "Retry without contractor" (§5.2): a new issue refused for its contractor uploads again under
 * the same id without him — the server never created it, so the id is still free. A refused
 * trade (deactivated since the phone last saw it) is dropped with him; the description stays.
 */
export async function dropContractor(id: string): Promise<void> {
  const item = await getItem(id);
  if (!item || item.kind !== 'create') return;
  await patchItem(id, {
    workerId: null,
    ...(item.lastError === 'INACTIVE_CATEGORY' && { categoryId: null }),
  });
}
