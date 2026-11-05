import { cookies } from 'next/headers';
import type { LoginResponse } from '@muayana/shared';
import { readEnvelope } from '@/lib/api-result';
import { forwardToApi } from '@/lib/api-proxy';
import { LOCALE_COOKIE } from '@/i18n/config';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-cookie';

/**
 * Sign-in: passes `{ email, password }` to the API and, on success, keeps the token in the
 * httpOnly session cookie and the user's language in the locale cookie. The browser gets the
 * user back, never the token. Failures pass through with the API's status and code (401, 429).
 */
export async function POST(request: Request): Promise<Response> {
  const upstream = await forwardToApi(request, ['auth', 'login'], undefined);
  const result = await readEnvelope<LoginResponse>(upstream);
  if (!result.success)
    return Response.json(
      {
        success: false,
        statusCode: result.status,
        error: result.error,
        message: result.message,
        data: result.data,
      },
      { status: result.status || 502 },
    );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.data.accessToken, sessionCookieOptions());
  jar.set(LOCALE_COOKIE, result.data.user.locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
  });
  return Response.json({
    success: true,
    statusCode: 200,
    data: { user: result.data.user },
  });
}
