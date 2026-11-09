import type { LoggerService } from '@nestjs/common';
import type { PhotoStorage } from './photo-storage.interface';

/**
 * Best-effort removal of stored photo files whose rows are gone (deleted, or never committed).
 * Runs after the transaction: a storage failure is logged and never undoes the delete.
 */
export async function discardPhotos(
  storage: PhotoStorage,
  keys: readonly string[],
  logger: Pick<LoggerService, 'warn'>,
): Promise<void> {
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (error) {
      logger.warn(`Could not delete stored photo ${key}: ${String(error)}`);
    }
  }
}
