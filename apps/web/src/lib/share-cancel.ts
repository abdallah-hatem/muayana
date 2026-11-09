/**
 * The engineer closed the share sheet without sharing: `navigator.share` rejects with an
 * `AbortError` (a DOMException, not always an Error subclass). Any other rejection is a refusal
 * (lost user activation, too many / too large files) and gets a fallback instead.
 */
export const isShareCancel = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError';
