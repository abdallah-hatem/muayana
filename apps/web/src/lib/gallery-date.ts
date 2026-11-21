/** A gallery photo older than this is dated now: a file date that far back is not the shot. */
const GALLERY_DATE_MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * When a photo picked from the gallery was taken (business §5.1): the file's date when it is a
 * believable past moment, otherwise now (some phones hand over the pick time or no date at all).
 */
export function galleryTakenAt(file: File, now: Date = new Date()): Date {
  const taken = file.lastModified;
  const age = now.getTime() - taken;
  if (!Number.isFinite(taken) || age < 0 || age > GALLERY_DATE_MAX_AGE_MS)
    return now;
  return new Date(taken);
}
