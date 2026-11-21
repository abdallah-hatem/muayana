import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Priority } from '@muayana/shared';

export type QueueKind = 'create' | 'addPhoto';
/**
 * `draft`: a photo stored while the capture sheet is still open — kept on the phone (nothing is
 * lost if the app closes) but not uploaded until the sheet is saved; a draft left behind by a
 * closed app is promoted to a photo-only upload on the next start.
 */
export type QueueStatus = 'draft' | 'pending' | 'failed';

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
  /**
   * The capture sheet's trade, contractor and priority (`create` only, §5.1). Absent on items
   * queued before the sheet existed: read with `?? null`.
   */
  categoryId?: string | null;
  workerId?: string | null;
  priority?: Priority | null;
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

/**
 * A photo imported from the gallery into the unsorted tray (business §5.1 step 5, N6): kept on the
 * phone, compressed, not an issue yet. It becomes one only when the engineer picks it for an issue.
 */
export interface TrayPhoto {
  /** UUID v4 made on the phone. */
  id: string;
  /** The site whose tray holds it; `null` when it was imported with "All sites" chosen. */
  siteId: string | null;
  /** When it was imported (epoch ms), shared by every photo of one pick. */
  importedAt: number;
  /** Import order across the tray: a pick keeps the order the gallery handed it over in. */
  seq: number;
  /** When the photo was taken (ISO): the gallery file's date when believable, else the import. */
  capturedAt: string;
  photo: QueuedPhoto;
}

interface QueueDb extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { bySeq: number };
  };
  tray: {
    key: string;
    value: TrayPhoto;
    indexes: { bySeq: number };
  };
}

const DB_NAME = 'muayana-capture';
/** 1: the upload queue. 2: the unsorted photos tray (N6), beside it so one write moves photos across. */
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<QueueDb>> | null = null;

export function queueDb(): Promise<IDBPDatabase<QueueDb>> {
  dbPromise ??= openDB<QueueDb>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('bySeq', 'seq');
      }
      if (oldVersion < 2) {
        const tray = db.createObjectStore('tray', { keyPath: 'id' });
        tray.createIndex('bySeq', 'seq');
      }
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
