/** `?a=1&b=x` from params, leaving out undefined and empty values ('' when nothing is left). */
export function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') q.set(key, String(value));
  const s = q.toString();
  return s ? `?${s}` : '';
}
