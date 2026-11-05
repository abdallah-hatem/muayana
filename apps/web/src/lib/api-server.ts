import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NETWORK_FAILURE, readEnvelope, type ApiResult } from './api-result';
import { apiBaseUrl } from './env';
import { PATHNAME_HEADER } from './auth-routing';
import { SIGN_OUT_PATH } from './routes';
import { SESSION_COOKIE } from './session-cookie';

export type ServerFetchOptions = Omit<RequestInit, 'body'> & {
  /** A JSON body (FormData passes through as is). */
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
};

/**
 * Server components' way to the API: the bearer from the httpOnly cookie, JSON in and the
 * envelope out as an ApiResult. A 401 means the session is dead: the render hands off to the
 * sign-out route (cookies are read-only here), which clears it and lands on login.
 */
export async function serverFetch<T>(
  path: string,
  { body, params, ...init }: ServerFetchOptions = {},
): Promise<ApiResult<T>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set('accept', 'application/json');
  if (token) requestHeaders.set('authorization', `Bearer ${token}`);
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm)
    requestHeaders.set('content-type', 'application/json');

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined) query.set(key, String(value));
  const qs = query.toString();

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      ...init,
      headers: requestHeaders,
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    return NETWORK_FAILURE;
  }

  if (res.status === 401) {
    const page = (await headers()).get(PATHNAME_HEADER) ?? '/';
    redirect(`${SIGN_OUT_PATH}?next=${encodeURIComponent(page)}`);
  }
  return readEnvelope<T>(res);
}
