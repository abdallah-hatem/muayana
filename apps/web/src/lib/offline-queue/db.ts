import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type QueueKind = 'create' | 'addPhoto';
export type QueueStatus = 'pending' | 'failed';

/** A compressed photo as bytes: Safari has refused Blobs in IndexedDB, ArrayBuffers always store. */
export interface QueuedPhoto {
  bytes: ArrayBuffer;
  type: string;
}

/** One upload waiting on the phone (business §5.2). */
export interface QueueItem {
  /** UUID v4 made on the phone. For `create` it is also the new issue's id, so a retry never duplicates. */
  id: string;
  kind: QueueKind;
  /** The issue the upload belongs to: `id` itself for `create`, the earlier issue for `addPhoto`. */
  issueId: string;
  siteId: string;
  /** When the photo was taken (ISO), not when it uploads. */
  capturedAt: string;
  note: string | null;
  location: string | null;
  photo: QueuedPhoto;
  attempts: number;
  status: QueueStatus;
  /** The API's error code (ARCHIVED_SITE, NETWORK_ERROR, HTTP_500, …) of the last failed try. */
  lastError: string | null;
  /** Upload order: items go up in the order they were taken. */
  seq: number;
  /** Not before this time (epoch ms): the backoff after a failed try. */
  nextAttemptAt: number;
}

interface QueueDb extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { bySeq: number };
  };
}

const DB_NAME = 'muayana-capture';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<QueueDb>> | null = null;

export function queueDb(): Promise<IDBPDatabase<QueueDb>> {
  dbPromise ??= openDB<QueueDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('queue', { keyPath: 'id' });
      store.createIndex('bySeq', 'seq');
    },
  });
  return dbPromise;
}

/** Closes the connection; the next call opens it again (an app reload, in tests). */
export async function closeQueueDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending).close();
}
