/** The file name from a Content-Disposition header (`filename*=` first), else `fallback`. */
export function fileNameFrom(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain name
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : fallback;
}

/** Saves a downloaded answer (a CSV) as a file on the device. */
export async function saveResponse(
  res: Response,
  fallback: string,
): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameFrom(
    res.headers.get('content-disposition'),
    fallback,
  );
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
