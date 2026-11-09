import { saveBlob } from './download';
import { isShareCancel } from './share-cancel';

/** How handing a file over ended. Only `cancelled` means nothing left the phone. */
export type FileShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Can this browser share exactly this file (Web Share level 2)? */
function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Shares a file through the phone's share sheet (WhatsApp, business §5.5) when the browser can
 * share it; otherwise — or when the share is refused for another reason than backing out — the
 * file is downloaded. Call it straight from the tap: the share needs the tap's user activation.
 */
export async function shareOrDownload(file: File): Promise<FileShareOutcome> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled';
      // Lost user activation or a refused file type: fall back to saving it.
    }
  }
  saveBlob(file, file.name);
  return 'downloaded';
}
