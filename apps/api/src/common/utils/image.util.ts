import { PHOTO_MAX_DIMENSION, PHOTO_MIME_TYPES } from '@muayana/shared';
import sharp from 'sharp';

export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length &&
  bytes.every((b, i) => buf[offset + i] === b);

/**
 * The image type from the file's first bytes (never the client's name or Content-Type):
 * JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`. `null` for anything else.
 */
export function sniffImageType(buf: Buffer): PhotoMimeType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'image/webp';
  return null;
}

export interface StoredImage {
  body: Buffer;
  contentType: 'image/jpeg';
  width: number;
  height: number;
}

/**
 * The stored form of a photo (business §3): EXIF orientation applied, long side at most
 * PHOTO_MAX_DIMENSION, JPEG. The phone already compresses; this guarantees it. Throws when the
 * bytes don't decode.
 */
export async function toStoredImage(input: Buffer): Promise<StoredImage> {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({
      width: PHOTO_MAX_DIMENSION,
      height: PHOTO_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return {
    body: data,
    contentType: 'image/jpeg',
    width: info.width,
    height: info.height,
  };
}
