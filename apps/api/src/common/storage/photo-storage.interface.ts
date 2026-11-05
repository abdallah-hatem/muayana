/** Where a stored file ended up: `key` deletes it later, `url` is what clients open. */
export interface StoredFile {
  key: string;
  url: string;
}

/**
 * Photo file storage (local disk in dev/test, Vercel Blob when deployed), chosen by
 * STORAGE_DRIVER. Inject with `@Inject(PHOTO_STORAGE)`.
 */
export interface PhotoStorage {
  /** Writes `body` under `key` (e.g. `issuePhotoKey(...)`) and returns where it lives. */
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  /** Removes a stored file; a missing file is not an error. */
  delete(key: string): Promise<void>;
}

export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');
