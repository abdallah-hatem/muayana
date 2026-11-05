import { ACCESS_TOKEN_TTL_DAYS } from '@muayana/shared';

/**
 * The session is one httpOnly cookie holding the API's 7-day access token. Only the server
 * (proxy, route handlers, server components) reads or writes it; the browser never sees it.
 */
export const SESSION_COOKIE = 'muayana_session';

export const sessionCookieOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  // lax, not strict: a link from WhatsApp must open the app signed in.
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60,
});

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return new TextDecoder().decode(
    Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
  );
}

/**
 * True when the cookie holds a token that hasn't expired yet. Read without verifying the
 * signature: it only steers routing (login page or app); the API verifies every request, so a
 * forged cookie shows an empty shell at most, never data.
 */
export function hasLiveToken(
  token: string | undefined,
  nowMs: number,
): boolean {
  const payload = token?.split('.')[1];
  if (!payload) return false;
  try {
    const { exp } = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof exp === 'number' && exp * 1000 > nowMs;
  } catch {
    return false;
  }
}
