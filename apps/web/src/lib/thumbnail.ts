import { fitWithin } from './compress-photo';
import { THUMB_LONG_SIDE, type Thumbnail } from './contractor-excel';

const THUMB_QUALITY = 0.75;

/**
 * A photo as a small JPEG (long side 320px) for embedding in the contractor Excel (§5.5): fetched
 * from its public URL, decoded, drawn smaller, encoded. Any failure answers null — the file is
 * still built, that cell left empty.
 */
export async function fetchThumbnail(
  url: string,
  longSide: number = THUMB_LONG_SIDE,
): Promise<Thumbnail | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    try {
      const size = fitWithin(bitmap.width, bitmap.height, longSide);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', THUMB_QUALITY),
      );
      if (!blob) return null;
      return { bytes: new Uint8Array(await blob.arrayBuffer()), ...size };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
