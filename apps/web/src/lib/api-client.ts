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

/**
 * How long a read (GET/HEAD) may go unanswered before it fails as a network error. A request that
 * never answers would leave its screen loading forever and hold one of the browser's six
 * connections to this origin; enough of them and client-side navigation stalls behind them.
 * Writes have no limit: a photo upload on a slow line may take longer, and abandoning a write the
 * server may still apply would make the offline queue send it twice.
 */
export const READ_TIMEOUT_MS = 15_000;

/** The caller's signal plus the read timeout, for GET/HEAD; writes keep the caller's signal. */
function withReadTimeout(init: RequestInit): RequestInit {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  const caller = init.signal;
  if (caller) {
    if (caller.aborted) controller.abort();
    else
      caller.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
  }
  controller.signal.addEventListener('abort', () => clearTimeout(timer), {
    once: true,
  });
  return { ...init, signal: controller.signal };
}

/** The session ended (401): go to login, coming back to this page afterwards. */
function toLogin(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.assign(loginUrlFor(here));
}

/**
 * Client components' way to the API, through the same-origin proxy (the token stays in its
 * httpOnly cookie). Answers the envelope as an ApiResult; a 401 sends the browser to login.
 * Pass `signal` to abort on unmount; a read also fails after READ_TIMEOUT_MS. An aborted or
 * timed-out request answers NETWORK_FAILURE, never throws.
 */
export async function clientFetch<T>(
  path: string,
  options: ClientFetchOptions = {},
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(
      `${API_PROXY_BASE}${path}`,
      withReadTimeout(toInit(options)),
    );
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
