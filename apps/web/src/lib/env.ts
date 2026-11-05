import 'server-only';

/**
 * Where the API lives (`apps/api`, base path `/api/v1`). Read on the server only: the browser
 * never talks to the API directly — T2 adds the cookie-forwarding `apiFetch` on top of this.
 */
export function apiBaseUrl(): string {
  const url = process.env.API_URL;
  if (!url)
    throw new Error(
      'Set API_URL to the API base, e.g. http://localhost:3101/api/v1',
    );
  return url.replace(/\/+$/, '');
}
