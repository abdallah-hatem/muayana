import { waMeUrl } from '@muayana/shared';

/**
 * Sending to a worker on WhatsApp (business §5.5): on a phone that can share files, the photos and
 * the text go through the share sheet; otherwise wa.me opens with the text, whose photo links stand
 * in for the files.
 */

/** How the hand-off to WhatsApp ended. Only `shared` and `linked` lead to "Mark as sent?". */
export type ShareOutcome = 'shared' | 'linked' | 'cancelled';

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

/**
 * The photos as files for the share sheet. Photo URLs are public (invariant §6.10). Any failure
 * answers `[]`, and the caller falls back to the link.
 */
export async function loadPhotoFiles(urls: readonly string[]): Promise<File[]> {
  try {
    return await Promise.all(
      urls.map(async (url, index) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`photo ${res.status}`);
        const blob = await res.blob();
        const type = blob.type || 'image/jpeg';
        const ext = type.split('/')[1] ?? 'jpg';
        return new File([blob], `photo-${index + 1}.${ext}`, { type });
      }),
    );
  } catch {
    return [];
  }
}

/** The engineer closed the share sheet (a DOMException, not always an Error subclass). */
const isAbort = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError';

/**
 * Hands the message to WhatsApp. With `files` the browser can share, the share sheet opens (the
 * engineer backing out answers `cancelled`); otherwise wa.me opens in a new tab.
 */
export async function shareToWhatsApp({
  text,
  phone,
  files,
}: {
  text: string;
  phone: string;
  files: readonly File[];
}): Promise<ShareOutcome> {
  if (
    files.length > 0 &&
    canShareFiles() &&
    navigator.canShare({ files: [...files] })
  ) {
    try {
      await navigator.share({ files: [...files], text });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Lost user activation or a refused file: fall through to the link.
    }
  }
  window.open(waMeUrl(phone, text), '_blank', 'noopener,noreferrer');
  return 'linked';
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
