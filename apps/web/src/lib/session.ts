import 'server-only';
import { cache } from 'react';
import type { User } from '@muayana/shared';
import { serverFetch } from './api-server';

/**
 * The signed-in engineer, read once per request. A refused token never returns here: serverFetch
 * hands the render to the sign-out route. `null` means the API couldn't be reached.
 */
export const getMe = cache(async (): Promise<User | null> => {
  const res = await serverFetch<User>('/auth/me');
  return res.success ? res.data : null;
});
