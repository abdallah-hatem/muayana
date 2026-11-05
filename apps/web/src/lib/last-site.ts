/**
 * The site the engineer used last, remembered on this phone (business §5.1: "the last one used is
 * preselected"). Shared by the top-bar site switcher and capture. Storage can be missing or
 * blocked (private mode): every access is guarded and falls back to "no site".
 */
export const LAST_SITE_KEY = 'muayana:lastSiteId';

export function readLastSiteId(): string | null {
  try {
    return window.localStorage.getItem(LAST_SITE_KEY);
  } catch {
    return null;
  }
}

export function writeLastSiteId(siteId: string | null): void {
  try {
    if (siteId) window.localStorage.setItem(LAST_SITE_KEY, siteId);
    else window.localStorage.removeItem(LAST_SITE_KEY);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}
