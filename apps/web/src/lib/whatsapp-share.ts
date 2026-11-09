import { waMeUrl } from '@muayana/shared';
import { isShareCancel } from './share-cancel';

/**
 * Sending to a contractor on WhatsApp (business §5.5, spec F3): on a phone that can share files,
 * the photo files go through the share sheet with the text as their caption (no photo links in
 * it); too many or too large for one share → several shares, one tap each. Otherwise wa.me opens
 * the contractor's chat with the text and its photo links.
 */

/** How the hand-off to WhatsApp ended. Only `shared` and `linked` lead to "Mark as sent?". */
export type ShareOutcome = 'shared' | 'linked' | 'cancelled';

/**
 * One share went out and more are left. Each needs its own tap (a share needs fresh user
 * activation), so the caller shows "Share part {part} of {parts}" and calls `next` on that tap.
 */
export interface ShareMore {
  part: number;
  parts: number;
  next: () => Promise<ShareStep>;
}

export type ShareStep = ShareOutcome | ShareMore;

/** Chromium's share limits (files and bytes per share); the browser's `canShare` decides too. */
export const SHARE_FILES_MAX = 10;
export const SHARE_BYTES_MAX = 50 * 1024 * 1024;

const PROBE = (): File[] => [
  new File([new Uint8Array([0])], 'probe.jpg', { type: 'image/jpeg' }),
];

/** Can this browser share image files (Web Share level 2)? */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: PROBE() });
  } catch {
    return false;
  }
}

/** One issue's photos as files, and whether any of them couldn't be fetched. */
export interface IssuePhotos<I extends { number: number }> {
  issue: I;
  files: File[];
  missing: boolean;
}

/**
 * The issue's photos as JPEG files named `#14-1.jpg`, `#14-2.jpg`… Photo URLs are public
 * (invariant §6.10). A photo that fails to fetch is left out and marks the issue `missing`.
 * `signal` stops the downloads; `onPhoto` is called as each photo settles (for a progress count).
 */
export async function loadIssuePhotos<I extends { number: number }>(
  issue: I,
  urls: readonly string[],
  { signal, onPhoto }: { signal?: AbortSignal; onPhoto?: () => void } = {},
): Promise<IssuePhotos<I>> {
  const results = await Promise.allSettled(
    urls.map(async (url, index) => {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`photo ${res.status}`);
        const blob = await res.blob();
        return new File([blob], `#${issue.number}-${index + 1}.jpg`, {
          type: 'image/jpeg',
        });
      } finally {
        onPhoto?.();
      }
    }),
  );
  const files = results.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );
  return { issue, files, missing: files.length < urls.length };
}

const bytes = (files: readonly File[]): number =>
  files.reduce((sum, f) => sum + f.size, 0);

/** Will the browser take these files in one share? */
export function fitsOneShare(files: readonly File[]): boolean {
  if (files.length === 0) return true;
  if (files.length > SHARE_FILES_MAX || bytes(files) > SHARE_BYTES_MAX)
    return false;
  try {
    return navigator.canShare({ files: [...files] });
  } catch {
    return false;
  }
}

/** Halves of a share: by issue when it holds several, else the one issue's files. */
function halve<I extends { number: number }>(
  packet: readonly IssuePhotos<I>[],
): IssuePhotos<I>[][] {
  if (packet.length > 1) {
    const mid = Math.ceil(packet.length / 2);
    return [packet.slice(0, mid), packet.slice(mid)];
  }
  const [only] = packet;
  const mid = Math.ceil(only.files.length / 2);
  return [
    [{ ...only, files: only.files.slice(0, mid) }],
    [{ ...only, files: only.files.slice(mid), missing: false }],
  ];
}

/**
 * The issues grouped into as few shares as the browser accepts, in order. An issue whose photos
 * don't fit even alone is split across consecutive shares.
 */
export function planShares<I extends { number: number }>(
  items: readonly IssuePhotos<I>[],
  fits: (files: readonly File[]) => boolean = fitsOneShare,
): IssuePhotos<I>[][] {
  const pieces: IssuePhotos<I>[] = [];
  const place = (item: IssuePhotos<I>) => {
    if (item.files.length <= 1 || fits(item.files)) pieces.push(item);
    else halve([item]).forEach(([half]) => place(half));
  };
  items.forEach(place);

  const packets: IssuePhotos<I>[][] = [];
  let current: IssuePhotos<I>[] = [];
  for (const piece of pieces) {
    const files = [...current.flatMap((p) => p.files), ...piece.files];
    if (current.length > 0 && !fits(files)) {
      packets.push(current);
      current = [];
    }
    current.push(piece);
  }
  if (current.length > 0) packets.push(current);
  return packets;
}

/** The distinct issues of a share, in order, and the numbers whose photo is missing. */
export function packetContent<I extends { number: number }>(
  packet: readonly IssuePhotos<I>[],
): { issues: I[]; missingPhotos: number[] } {
  const issues: I[] = [];
  for (const p of packet) if (!issues.includes(p.issue)) issues.push(p.issue);
  return {
    issues,
    missingPhotos: packet.filter((p) => p.missing).map((p) => p.issue.number),
  };
}

/**
 * Hands the issues to WhatsApp. With photo files the browser can share, the first share opens
 * now and each further one on its own tap (`ShareMore`); a share the browser refuses (too many /
 * too large) is split in two and retried on the next tap. Backing out of any share answers
 * `cancelled`. Without file sharing, or with no photo file at all, wa.me opens the contractor's
 * chat with the fallback text (which carries the photo links).
 */
export async function shareInParts<I extends { number: number }>({
  packets,
  caption,
  phone,
  fallbackText,
}: {
  packets: readonly IssuePhotos<I>[][];
  caption: (
    packet: readonly IssuePhotos<I>[],
    part: { index: number; count: number },
  ) => string;
  phone: string;
  fallbackText: () => string;
}): Promise<ShareStep> {
  const link = (): ShareOutcome => {
    window.open(
      waMeUrl(phone, fallbackText()),
      '_blank',
      'noopener,noreferrer',
    );
    return 'linked';
  };
  const hasFiles = packets.some((packet) =>
    packet.some((p) => p.files.length > 0),
  );
  if (!hasFiles || !canShareFiles()) return link();

  const run = async (
    queue: readonly IssuePhotos<I>[][],
    index: number,
  ): Promise<ShareStep> => {
    const packet = queue[index];
    const files = packet.flatMap((p) => p.files);
    try {
      await navigator.share({
        files,
        text: caption(packet, { index: index + 1, count: queue.length }),
      });
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled';
      // Refused — too many / too large, or the tap's activation ran out: split, retry on a tap.
      if (files.length > 1) {
        const split = [
          ...queue.slice(0, index),
          ...halve(packet),
          ...queue.slice(index + 1),
        ];
        return {
          part: index + 1,
          parts: split.length,
          next: () => run(split, index),
        };
      }
      return link();
    }
    if (index + 1 >= queue.length) return 'shared';
    return {
      part: index + 2,
      parts: queue.length,
      next: () => run(queue, index + 1),
    };
  };
  return run(packets, 0);
}

/** An absolute link for a photo URL (dev serves relative `/uploads/…`). */
export const photoBaseUrl = (): string | undefined =>
  typeof window === 'undefined' ? undefined : window.location.origin;

/** A WhatsApp chat with the number, no message (the worker list's and page's WhatsApp buttons). */
export const whatsappChatUrl = (phone: string): string =>
  `https://wa.me/${phone.replace(/\D/g, '')}`;

/** The phone dialler. */
export const telUrl = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, '')}`;
