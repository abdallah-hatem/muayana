import { apiBaseUrl } from './env';

/** Request headers worth passing to the API; everything else (cookies above all) stays here. */
const FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'content-length',
  'if-none-match',
];

/**
 * Response headers that describe the connection to the API, not the body: fetch has already
 * decoded the body, so its encoding and length no longer apply.
 */
const DROP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'set-cookie',
]);

/** `/api/proxy/a/b?x=1` → `<API_URL>/a/b?x=1`. Segments are re-encoded one by one. */
export function upstreamUrl(segments: string[], search: string): string {
  const path = segments.map(encodeURIComponent).join('/');
  return `${apiBaseUrl()}/${path}${search}`;
}

/**
 * Sends the browser's request on to the API with the session's bearer token and streams the
 * answer back untouched: multipart uploads go up as a stream (never parsed or buffered here)
 * and CSV downloads come back as a stream with their Content-Type and Content-Disposition.
 */
export async function forwardToApi(
  request: Request,
  segments: string[],
  token: string | undefined,
): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (token) headers.set('authorization', `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && request.body;
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    cache: 'no-store',
  };
  if (hasBody) init.duplex = 'half';

  let upstream: Response;
  try {
    upstream = await fetch(
      upstreamUrl(segments, new URL(request.url).search),
      init,
    );
  } catch {
    return Response.json(
      {
        success: false,
        statusCode: 502,
        error: 'NETWORK_ERROR',
        message: 'The API could not be reached',
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!DROP_RESPONSE_HEADERS.has(name.toLowerCase()))
      responseHeaders.set(name, value);
  });
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
