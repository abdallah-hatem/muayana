import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { BlobPhotoStorage } from './blob-photo.storage';
import { LocalPhotoStorage } from './local-photo.storage';
import { createPhotoStorage } from './storage.module';

function config(env: Partial<Env>): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => env[key],
  } as unknown as ConfigService<Env, true>;
}

describe('createPhotoStorage', () => {
  it('picks Vercel Blob when STORAGE_DRIVER=blob', () => {
    const storage = createPhotoStorage(
      config({ STORAGE_DRIVER: 'blob', BLOB_READ_WRITE_TOKEN: 't' }),
    );
    expect(storage).toBeInstanceOf(BlobPhotoStorage);
  });

  it('picks local disk when STORAGE_DRIVER=local', () => {
    const storage = createPhotoStorage(
      config({
        STORAGE_DRIVER: 'local',
        UPLOAD_DIR: 'uploads',
        PUBLIC_UPLOAD_BASE_URL: 'http://localhost:3101/uploads',
      }),
    );
    expect(storage).toBeInstanceOf(LocalPhotoStorage);
  });
});
