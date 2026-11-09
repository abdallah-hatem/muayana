/** The file name from a `Content-Disposition` header (`filename*=` wins over `filename=`). */
export function fileNameFrom(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // A malformed encoded name falls through to the plain one.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : fallback;
}

/** Hands a file to the browser to save under `name`. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the click start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Hands a downloaded response to the browser as a file to save. */
export async function saveResponse(
  res: Response,
  fallbackName: string,
): Promise<void> {
  saveBlob(
    await res.blob(),
    fileNameFrom(res.headers.get('content-disposition'), fallbackName),
  );
}
