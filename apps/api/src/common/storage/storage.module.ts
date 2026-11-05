import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { resolveUploadDir } from '../utils/upload-dir.util';
import { BlobPhotoStorage } from './blob-photo.storage';
import { LocalPhotoStorage } from './local-photo.storage';
import { PHOTO_STORAGE, type PhotoStorage } from './photo-storage.interface';

/** The photo storage driver STORAGE_DRIVER names (env validation guarantees its settings). */
export function createPhotoStorage(
  config: ConfigService<Env, true>,
): PhotoStorage {
  if (config.get('STORAGE_DRIVER', { infer: true }) === 'blob') {
    return new BlobPhotoStorage(
      config.get('BLOB_READ_WRITE_TOKEN', { infer: true }) ?? '',
    );
  }
  return new LocalPhotoStorage(
    resolveUploadDir(config.get('UPLOAD_DIR', { infer: true })),
    config.get('PUBLIC_UPLOAD_BASE_URL', { infer: true }) ?? '',
  );
}

/** Provides PHOTO_STORAGE app-wide. */
@Global()
@Module({
  providers: [
    {
      provide: PHOTO_STORAGE,
      inject: [ConfigService],
      useFactory: createPhotoStorage,
    },
  ],
  exports: [PHOTO_STORAGE],
})
export class StorageModule {}
