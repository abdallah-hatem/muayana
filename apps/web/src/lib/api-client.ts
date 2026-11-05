import { NETWORK_FAILURE, readEnvelope, type ApiResult } from './api-result';
import { loginUrlFor } from './routes';

/** Browser path of the API proxy (src/app/api/proxy/[...path]/route.ts). */
export const API_PROXY_BASE = '/api/proxy';

export type ClientFetchOptions = Omit<RequestInit, 'body'> & {
  /** JSON (serialised here) or FormData (sent as multipart, untouched). */
  body?: unknown;
};

function toInit({ body, ...init }: ClientFetchOptions): RequestInit {
  const headers = new Headers(init.headers);
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm)
    headers.set('content-type', 'application/json');
  return {
    ...init,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  };
}

/** The session ended (401): go to login, coming back to this page afterwards. */
function toLogin(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.assign(loginUrlFor(here));
}

/**
 * Client components' way to the API, through the same-origin proxy (the token stays in its
 * httpOnly cookie). Answers the envelope as an ApiResult; a 401 sends the browser to login.
 */
export async function clientFetch<T>(
  path: string,
  options: ClientFetchOptions = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_PROXY_BASE}${path}`, toInit(options));
  } catch {
    return NETWORK_FAILURE;
  }
  if (res.status === 401) toLogin();
  return readEnvelope<T>(res);
}

/**
 * The raw Response, for answers that are not the envelope (CSV downloads): the caller reads
 * `blob()` and the Content-Disposition file name. Still sends a 401 to login.
 */
export async function clientFetchRaw(
  path: string,
  options: ClientFetchOptions = {},
): Promise<Response | null> {
  try {
    const res = await fetch(`${API_PROXY_BASE}${path}`, toInit(options));
    if (res.status === 401) toLogin();
    return res;
  } catch {
    return null;
  }
}

/** Same-origin auth route handlers (login/logout), which set and clear the session cookie. */
export async function authRoute<T>(
  path: '/api/auth/login' | '/api/auth/logout',
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    return await readEnvelope<T>(
      await fetch(path, toInit({ method: 'POST', body })),
    );
  } catch {
    return NETWORK_FAILURE;
  }
}
