import { compressPhoto, PhotoUnreadableError } from '@/lib/compress-photo';
import { galleryTakenAt } from '@/lib/gallery-date';
import {
  emitQueueChange,
  makeQueueItem,
  queueDb,
  type CaptureDetails,
  type TrayPhoto,
} from '@/lib/offline-queue';
import { newUuid } from '@/lib/uuid';

/**
 * The unsorted photos tray (business §5.1 step 5, N6): photos imported from the gallery wait on
 * the phone, per site, until the engineer picks some of them for one issue. They sit in IndexedDB
 * beside the upload queue, so turning them into an issue is one write: the queue items are stored
 * and the photos leave the tray together, or neither happens.
 */

/** Above this many photos the tray warns (never blocks): the phone's storage is not endless. */
export const TRAY_WARN_AT = 100;

/** A photo picked for an issue is no longer in the tray (deleted, or already made into an issue). */
export class TrayPhotoMissingError extends Error {
  constructor() {
    super('TRAY_PHOTO_MISSING');
  }
}

const listeners = new Set<() => void>();

/** Called after every change to the tray (and while an import runs). Returns the unsubscribe. */
export function onTrayChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  for (const listener of listeners) listener();
}

let importing = 0;

/** Photos of a running import not stored yet (the tray shows a placeholder for each). */
export const importingCount = (): number => importing;

/** The phone's storage is full: IndexedDB refuses the write. */
export function isQuotaError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

export interface ImportResult {
  /** Stored in the tray. */
  added: number;
  /** The phone could not read these photos; they were left out. */
  unreadable: number;
  /** Storage filled up: this many were not stored (the ones before it were). */
  notStored: number;
  /** Photos in this tray after the import (the site's, or all of them for "All sites"). */
  total: number;
}

/**
 * Imports gallery photos into a site's tray (`null`: "All sites"; the site is asked when an issue
 * is made). Each photo is compressed and stored on its own, in the order picked, so a full phone
 * keeps the ones that fit. A photo is dated by its file when believable (galleryTakenAt).
 */
export async function addToTray(
  files: File[],
  siteId: string | null,
  now: Date = new Date(),
): Promise<ImportResult> {
  const result: ImportResult = {
    added: 0,
    unreadable: 0,
    notStored: 0,
    total: 0,
  };
  importing += files.length;
  let left = files.length;
  emitChange();
  const importedAt = now.getTime();
  try {
    for (const file of files) {
      try {
        if (result.notStored > 0) {
          // Storage is full: the rest would fail the same way.
          result.notStored += 1;
          continue;
        }
        await storeOne(file, siteId, importedAt, now);
        result.added += 1;
      } catch (error) {
        if (error instanceof PhotoUnreadableError) result.unreadable += 1;
        else if (isQuotaError(error)) result.notStored += 1;
        else throw error;
      } finally {
        importing -= 1;
        left -= 1;
        // Shown as it lands: the grid fills while a long pick is still being compressed.
        emitChange();
      }
    }
  } finally {
    // Whatever stopped the loop, its placeholders go.
    importing -= left;
    if (left > 0) emitChange();
  }
  result.total = (await listTray(siteId)).length;
  return result;
}

async function storeOne(
  file: File,
  siteId: string | null,
  importedAt: number,
  now: Date,
): Promise<void> {
  const { blob } = await compressPhoto(file);
  const bytes = await blob.arrayBuffer();
  const db = await queueDb();
  const tx = db.transaction('tray', 'readwrite');
  try {
    const last = await tx.store.index('bySeq').openCursor(null, 'prev');
    await tx.store.add({
      id: newUuid(),
      siteId,
      importedAt,
      seq: (last?.value.seq ?? 0) + 1,
      capturedAt: galleryTakenAt(file, now).toISOString(),
      photo: { bytes, type: blob.type || 'image/jpeg' },
    });
    await tx.done;
  } catch (error) {
    const txError = tx.error;
    await tx.done.catch(() => undefined);
    // A full disk shows up on the request or only on the transaction, depending on the browser.
    if (isQuotaError(error) || isQuotaError(txError))
      throw Object.assign(new Error('QUOTA'), { name: 'QuotaExceededError' });
    throw error;
  }
}

/** The tray's photos in import order; `siteId` narrows to one site's tray, `null` is all of them. */
export async function listTray(siteId: string | null): Promise<TrayPhoto[]> {
  const all = await (await queueDb()).getAllFromIndex('tray', 'bySeq');
  return siteId === null ? all : all.filter((p) => p.siteId === siteId);
}

/** «حذف»: the photos leave the phone for good (the screen confirms first). */
export async function removeFromTray(ids: readonly string[]): Promise<void> {
  const db = await queueDb();
  const tx = db.transaction('tray', 'readwrite');
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
  emitChange();
}

export interface TrayIssueInput {
  /** The phone-made id of the new issue, chosen when its sheet opened (retries reuse it). */
  issueId: string;
  siteId: string;
  /** In pick order: the first is the issue's first photo. */
  photoIds: readonly string[];
  /** The sheet's fields; `{}` for photo only. */
  details: CaptureDetails;
}

/**
 * Makes one issue from tray photos (N6): a `create` with the first photo and an `addPhoto` for
 * each of the others, in pick order, all carrying `issueId`; the photos leave the tray in the same
 * write, so they leave only once the uploads are stored safely, and a failed write changes
 * nothing. Retrying with the same `issueId` after it went through adds nothing (`already`).
 */
export async function trayToIssue(
  input: TrayIssueInput,
): Promise<'created' | 'already'> {
  if (input.photoIds.length === 0) throw new TrayPhotoMissingError();
  const db = await queueDb();
  const tx = db.transaction(['queue', 'tray'], 'readwrite');
  const queue = tx.objectStore('queue');
  const tray = tx.objectStore('tray');
  try {
    if (await queue.get(input.issueId)) {
      await tx.done;
      return 'already';
    }
    const photos: TrayPhoto[] = [];
    for (const id of input.photoIds) {
      const photo = await tray.get(id);
      if (!photo) throw new TrayPhotoMissingError();
      photos.push(photo);
    }
    const last = await queue.index('bySeq').openCursor(null, 'prev');
    const seq = last?.value.seq ?? 0;
    for (const [index, photo] of photos.entries()) {
      const first = index === 0;
      await queue.add(
        makeQueueItem({
          kind: first ? 'create' : 'addPhoto',
          id: first ? input.issueId : newUuid(),
          issueId: input.issueId,
          siteId: input.siteId,
          capturedAt: photo.capturedAt,
          ...(first && input.details),
          photo: photo.photo,
          seq: seq + index + 1,
        }),
      );
      await tray.delete(photo.id);
    }
    await tx.done;
  } catch (error) {
    const txError = tx.error;
    try {
      tx.abort();
    } catch {
      // Already finished or aborted by the failure itself.
    }
    await tx.done.catch(() => undefined);
    if (!(error instanceof TrayPhotoMissingError) && isQuotaError(txError))
      throw Object.assign(new Error('QUOTA'), { name: 'QuotaExceededError' });
    throw error;
  }
  emitQueueChange();
  emitChange();
  return 'created';
}
