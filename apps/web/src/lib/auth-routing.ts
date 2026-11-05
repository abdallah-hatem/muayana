import { NextResponse, type NextRequest } from 'next/server';
import { isGuestOnly, isPublic, loginUrlFor, ROUTES } from './routes';
import { SESSION_COOKIE, hasLiveToken } from './session-cookie';

/** Header the proxy adds so server code knows the page being rendered (the 401 hand-off). */
export const PATHNAME_HEADER = 'x-pathname';

/**
 * Auth routing on the first request, before anything renders (Next 16 `proxy.ts`):
 * - signed out (no cookie, or an expired token) on an app page → login, keeping the path;
 * - signed in on the login page → home;
 * - an expired cookie is cleared on the way.
 * The API still verifies every request; this only decides which page to show.
 */
export function authRouting(
  request: NextRequest,
  nowMs = Date.now(),
): NextResponse {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = hasLiveToken(token, nowMs);

  const forwarded = new Headers(request.headers);
  forwarded.set(PATHNAME_HEADER, `${pathname}${search}`);
  const render = () => NextResponse.next({ request: { headers: forwarded } });

  let response: NextResponse;
  if (isPublic(pathname)) response = render();
  else if (isGuestOnly(pathname))
    response = signedIn
      ? NextResponse.redirect(new URL(ROUTES.dashboard, request.url))
      : render();
  else if (!signedIn)
    response = NextResponse.redirect(
      new URL(loginUrlFor(`${pathname}${search}`), request.url),
    );
  else response = render();

  if (token && !signedIn) response.cookies.delete(SESSION_COOKIE);
  return response;
}
