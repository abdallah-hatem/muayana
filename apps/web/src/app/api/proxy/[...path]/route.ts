import { cookies } from 'next/headers';
import { forwardToApi } from '@/lib/api-proxy';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/**
 * The browser's only way to the API: `/api/proxy/<api path>` with the bearer token taken from
 * the httpOnly session cookie. Bodies and answers stream through untouched (photo uploads,
 * CSV downloads). A 401 also clears the cookie, so the next page load lands on login.
 */
async function handle(
  request: Request,
  ctx: RouteContext<'/api/proxy/[...path]'>,
): Promise<Response> {
  const { path } = await ctx.params;
  const jar = await cookies();
  const response = await forwardToApi(
    request,
    path,
    jar.get(SESSION_COOKIE)?.value,
  );
  if (response.status === 401) jar.delete(SESSION_COOKIE);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

export const dynamic = 'force-dynamic';
