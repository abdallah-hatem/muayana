import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { resolveUploadDir } from '../utils/upload-dir.util';
import { BlobPhotoStorage } from './blob-photo.storage';
import { LocalPhotoStorage } from './local-photo.storage';
import { PHOTO_STORAGE, type PhotoStorage } from './photo-storage.interface';

/** What picks and configures a photo storage driver (the STORAGE_DRIVER group of variables). */
export type PhotoStorageSettings = Pick<
  Env,
  'STORAGE_DRIVER' | 'UPLOAD_DIR' | 'PUBLIC_UPLOAD_BASE_URL' | 'BLOB_READ_WRITE_TOKEN'
>;

/**
 * The driver STORAGE_DRIVER names. Shared by the API and the seed (prisma/seed.ts), so sample
 * photos land where the API's own uploads do.
 */
export function photoStorageFor(settings: PhotoStorageSettings): PhotoStorage {
  if (settings.STORAGE_DRIVER === 'blob') {
    if (!settings.BLOB_READ_WRITE_TOKEN)
      throw new Error('BLOB_READ_WRITE_TOKEN is required when STORAGE_DRIVER=blob');
    return new BlobPhotoStorage(settings.BLOB_READ_WRITE_TOKEN);
  }
  return new LocalPhotoStorage(
    resolveUploadDir(settings.UPLOAD_DIR),
    settings.PUBLIC_UPLOAD_BASE_URL ?? '',
  );
}

/** The photo storage driver from the validated config (env validation guarantees its settings). */
export function createPhotoStorage(
  config: ConfigService<Env, true>,
): PhotoStorage {
  return photoStorageFor({
    STORAGE_DRIVER: config.get('STORAGE_DRIVER', { infer: true }),
    UPLOAD_DIR: config.get('UPLOAD_DIR', { infer: true }),
    PUBLIC_UPLOAD_BASE_URL: config.get('PUBLIC_UPLOAD_BASE_URL', {
      infer: true,
    }),
    BLOB_READ_WRITE_TOKEN: config.get('BLOB_READ_WRITE_TOKEN', {
      infer: true,
    }),
  });
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
