import sharp from 'sharp';
import type {
  PhotoStorage,
  StoredFile,
} from '../src/common/storage/photo-storage.interface';

/*
 * The seed's photo step: sample placeholder photos go through the same PhotoStorage driver the
 * API uses (local disk or Vercel Blob, by STORAGE_DRIVER), so a Preview seeded with sample data
 * shows them like real uploads. The photo rows store what the driver returns (Blob adds a random
 * suffix to the key), never a key or URL the seed made up.
 */

export const PLACEHOLDER_SIZE = { width: 800, height: 600 };

/** One sample photo: where it goes (`issuePhotoKey`) and what it shows. */
export interface PlaceholderPhoto {
  key: string;
  color: string;
  label: string;
}

/** A small JPEG: the category colour with the issue number stencilled on. */
export async function renderPlaceholder(
  color: string,
  label: string,
): Promise<Buffer> {
  const { width, height } = PLACEHOLDER_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <rect y="500" width="100%" height="100" fill="#15171B" opacity="0.6"/>
    <text x="40" y="572" font-family="monospace" font-size="56" font-weight="700" fill="#F4F1EA">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

/** Renders and stores each photo; returns where the driver put it, by the requested key. */
export async function storePlaceholders(
  storage: PhotoStorage,
  photos: readonly PlaceholderPhoto[],
): Promise<Map<string, StoredFile>> {
  const stored = new Map<string, StoredFile>();
  for (const photo of photos) {
    stored.set(
      photo.key,
      await storage.put(
        photo.key,
        await renderPlaceholder(photo.color, photo.label),
        'image/jpeg',
      ),
    );
  }
  return stored;
}

/**
 * Local driver only: writes back any placeholder whose file is gone (a wiped uploads folder), at
 * the same key. Returns how many were rewritten. Blob files are never rewritten: a second put
 * would get a new random key the stored row doesn't know.
 */
export async function restoreMissingPlaceholders(
  storage: PhotoStorage,
  photos: readonly PlaceholderPhoto[],
  exists: (key: string) => Promise<boolean>,
): Promise<number> {
  const missing: PlaceholderPhoto[] = [];
  for (const photo of photos)
    if (!(await exists(photo.key))) missing.push(photo);
  await storePlaceholders(storage, missing);
  return missing.length;
}
