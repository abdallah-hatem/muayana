import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/** Sign-out: forgets the session cookie (the token simply expires; there is nothing to revoke). */
export async function POST(): Promise<Response> {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ success: true, statusCode: 200, data: null });
}
