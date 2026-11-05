import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { PhotoStorage, StoredFile } from './photo-storage.interface';

/**
 * Local driver: files under UPLOAD_DIR, served by the static `/uploads` route (app.setup.ts) at
 * `${PUBLIC_UPLOAD_BASE_URL}/<key>`.
 */
export class LocalPhotoStorage implements PhotoStorage {
  private readonly baseUrl: string;

  constructor(
    private readonly root: string,
    publicBaseUrl: string,
  ) {
    this.baseUrl = publicBaseUrl.replace(/\/+$/, '');
  }

  async put(
    key: string,
    body: Buffer,
    _contentType?: string,
  ): Promise<StoredFile> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, url: `${this.baseUrl}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  /** The file's path; a key escaping the root (`../`) is refused. */
  private pathOf(key: string): string {
    const root = resolve(this.root);
    const path = resolve(join(root, key));
    if (!path.startsWith(root + sep)) {
      throw new Error(`Storage key outside the upload folder: ${key}`);
    }
    return path;
  }
}
