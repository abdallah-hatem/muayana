import { compressPhoto } from '@/lib/compress-photo';
import type { LastIssue } from '@/lib/capture-prefs';
import { enqueue, syncQueue, type QueueItem } from '@/lib/offline-queue';

export type ShotMode = 'new' | 'attach';

export interface ShotInput {
  file: Blob;
  siteId: string;
  /** `attach` adds the photo to `previous` instead of opening a new issue. */
  mode: ShotMode;
  previous: LastIssue | null;
  note?: string;
  location?: string;
  capturedAt?: Date;
}

export interface ShotResult {
  item: QueueItem;
  /** The issue the next "add to previous" joins. */
  lastIssue: LastIssue;
  photo: Blob;
}

/**
 * One shot (business §5.1): compress on the phone, store in the queue (nothing is lost if the
 * app closes), then try to upload. A new photo is a new issue; "add to previous" attaches it to
 * the last issue of the same site and creates none.
 */
export async function takeShot(input: ShotInput): Promise<ShotResult> {
  const capturedAt = (input.capturedAt ?? new Date()).toISOString();
  const { blob } = await compressPhoto(input.file);
  const attach =
    input.mode === 'attach' &&
    input.previous !== null &&
    input.previous.siteId === input.siteId;

  const item = attach
    ? await enqueue({
        kind: 'addPhoto',
        issueId: input.previous!.issueId,
        siteId: input.siteId,
        capturedAt,
        photo: blob,
      })
    : await enqueue({
        kind: 'create',
        siteId: input.siteId,
        capturedAt,
        note: input.note,
        location: input.location,
        photo: blob,
      });

  void syncQueue();
  return {
    item,
    lastIssue: { issueId: item.issueId, siteId: input.siteId },
    photo: blob,
  };
}
