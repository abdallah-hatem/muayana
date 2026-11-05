import { NextResponse, type NextRequest } from 'next/server';
import { loginUrlFor } from '@/lib/routes';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/**
 * Where a server render lands when the API refuses a token the proxy thought was live (the
 * account changed, the secret rotated): clear the cookie here, where it is writable, and go to
 * login keeping the page. Without this the proxy would bounce between login and the page.
 */
export function GET(request: NextRequest): NextResponse {
  const next = request.nextUrl.searchParams.get('next') ?? '/';
  const response = NextResponse.redirect(
    new URL(loginUrlFor(next), request.url),
  );
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
