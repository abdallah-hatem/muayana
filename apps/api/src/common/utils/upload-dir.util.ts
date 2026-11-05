import { isAbsolute, resolve } from 'node:path';

/** URL path local photo files are served under (outside /api/v1 and outside the JWT guard). */
export const UPLOADS_ROUTE = '/uploads';

/**
 * The local driver's folder on disk: UPLOAD_DIR as given when absolute, else relative to the
 * API's working directory (apps/api). The static route, the storage driver and the seed share it.
 */
export function resolveUploadDir(
  uploadDir: string,
  cwd = process.cwd(),
): string {
  return isAbsolute(uploadDir) ? uploadDir : resolve(cwd, uploadDir);
}

/** Storage key of an issue photo; the same layout on disk and in Blob. */
export function issuePhotoKey(issueId: string, photoId: string): string {
  return `issues/${issueId}/${photoId}.jpg`;
}
