import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_MIME_TYPES,
} from '@muayana/shared';

const JPEG_QUALITY = 0.82;

/** The size that fits `width × height` within `max` on its long side, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  max: number = PHOTO_MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

export class PhotoUnreadableError extends Error {
  constructor() {
    super('PHOTO_UNREADABLE');
  }
}

/**
 * Decodes with the camera's EXIF orientation applied, so the pixels come out upright and the
 * JPEG we write (which carries no EXIF) still shows the right way up.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoUnreadableError())),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}

/**
 * Compresses a camera photo on the phone (business §3): long side at most 1600px, JPEG. When the
 * browser can't decode it, a photo the API already accepts goes up as it is; anything else is
 * refused with PhotoUnreadableError.
 */
export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    const accepted =
      (PHOTO_MIME_TYPES as readonly string[]).includes(file.type) &&
      file.size <= PHOTO_MAX_BYTES;
    if (accepted) return { blob: file, width: 0, height: 0 };
    throw new PhotoUnreadableError();
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoUnreadableError();
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    return { blob: await toJpeg(canvas), ...size };
  } finally {
    bitmap.close();
  }
}
