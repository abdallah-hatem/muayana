import { del, put } from '@vercel/blob';
import type { PhotoStorage, StoredFile } from './photo-storage.interface';

/**
 * Vercel Blob driver: public files with a random suffix, so the URL is unguessable
 * (business §6.10). The returned pathname is the key used to delete the file.
 */
export class BlobPhotoStorage implements PhotoStorage {
  constructor(private readonly token: string) {}

  async put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    const blob = await put(key, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      token: this.token,
    });
    return { key: blob.pathname, url: blob.url };
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }
}
