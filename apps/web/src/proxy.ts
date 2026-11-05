import type { NextRequest } from 'next/server';
import { authRouting } from '@/lib/auth-routing';

/** Next 16's request proxy (formerly `middleware`): sends signed-out visitors to /login. */
export function proxy(request: NextRequest) {
  return authRouting(request);
}

export const config = {
  // Pages only. Not /api (route handlers answer 401 themselves, and photo uploads must stream
  // through /api/proxy without the proxy buffering their bodies), not Next's assets, not files.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
