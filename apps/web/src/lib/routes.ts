/** Every app route in one place: the nav, the proxy and the tests read these. */
export const ROUTES = {
  dashboard: '/',
  issues: '/issues',
  capture: '/capture',
  inbox: '/inbox',
  workers: '/workers',
  settings: '/settings',
  login: '/login',
} as const;

/** Clears the session cookie and lands on login (used when the API refuses a token mid-render). */
export const SIGN_OUT_PATH = '/api/auth/signout';

/** Pages anyone may open, signed in or not (the dev-only design preview). */
const PUBLIC_PREFIXES = ['/design'];

/** Pages only a signed-out visitor sees; a signed-in one goes home instead. */
const GUEST_ONLY = new Set<string>([ROUTES.login]);

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPublic = (pathname: string): boolean =>
  PUBLIC_PREFIXES.some((p) => matches(pathname, p));

export const isGuestOnly = (pathname: string): boolean =>
  GUEST_ONLY.has(pathname);

/**
 * A return path that stays on this site: a single leading slash, no protocol-relative `//`
 * or backslash trick, never the login page itself. Anything else → home.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.includes('\\') || /[\u0000-\u001f]/.test(next)) return '/';
  if (matches(next.split('?')[0], ROUTES.login)) return '/';
  return next;
}

/** The login page, keeping where to return after signing in. */
export function loginUrlFor(next: string): string {
  const target = safeNext(next);
  return target === '/'
    ? ROUTES.login
    : `${ROUTES.login}?next=${encodeURIComponent(target)}`;
}
