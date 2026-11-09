import { compressPhoto } from '@/lib/compress-photo';
import type { LastIssue } from '@/lib/capture-prefs';
import {
  commitDraft,
  enqueue,
  syncQueue,
  type CaptureDetails,
  type QueueItem,
} from '@/lib/offline-queue';

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
  /**
   * Kept on the phone but not uploaded yet: the capture sheet is open for this issue
   * (saveCapture releases it).
   */
  draft?: boolean;
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
        draft: input.draft,
      })
    : await enqueue({
        kind: 'create',
        siteId: input.siteId,
        capturedAt,
        note: input.note,
        location: input.location,
        photo: blob,
        draft: input.draft,
      });

  if (!input.draft) void syncQueue();
  return {
    item,
    lastIssue: { issueId: item.issueId, siteId: input.siteId },
    photo: blob,
  };
}

/**
 * The capture sheet is saved (business §5.1): the drafted issue takes the sheet's fields (none
 * for "photo only") and it and its photos go up in one go, through the queue as always.
 */
export async function saveCapture(
  issueId: string,
  details: CaptureDetails = {},
): Promise<void> {
  await commitDraft(issueId, details);
  void syncQueue();
}
