import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_PER_EMAIL,
  normalizeEmail,
} from '@muayana/shared';
import type { FailureWindow } from './interfaces/login-attempt-store.interface';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;

/** The two counters one sign-in attempt touches. */
export interface LoginAttemptKeys {
  /** Caller IP + email (normalised, so case doesn't dodge it): the per-IP limit. */
  perIp: string;
  /** Email alone, across every IP: the ceiling a spoofed or missing IP can't escape. */
  perEmail: string;
}

/** Keys for an attempt. Callers with no known IP share one `unknown` bucket per email. */
export function loginAttemptKeys(
  ip: string | undefined,
  email: string,
): LoginAttemptKeys {
  const normalized = normalizeEmail(email);
  return {
    perIp: `ip:${ip || 'unknown'}|${normalized}`,
    perEmail: `email:${normalized}`,
  };
}

/** Failures at or after this instant count toward the limit. */
export function loginWindowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_MS);
}

/** Whole seconds until the oldest counted failure leaves the window (the Retry-After value). */
export function retryAfterSeconds(oldestFailure: Date, now: Date): number {
  const until = oldestFailure.getTime() + WINDOW_MS - now.getTime();
  return Math.max(1, Math.ceil(until / 1000));
}

const NO_FAILURES: FailureWindow = { count: 0, oldest: null };

/**
 * Null when the attempt may go ahead; otherwise the seconds to wait (429). Locked when the
 * per-IP count reaches LOGIN_MAX_FAILURES or the per-email count reaches
 * LOGIN_MAX_FAILURES_PER_EMAIL; the wait is the longer of the locked counters'.
 */
export function loginLockedFor(
  windows: { perIp?: FailureWindow; perEmail?: FailureWindow },
  now: Date,
): number | null {
  const counters = [
    { window: windows.perIp ?? NO_FAILURES, limit: LOGIN_MAX_FAILURES },
    {
      window: windows.perEmail ?? NO_FAILURES,
      limit: LOGIN_MAX_FAILURES_PER_EMAIL,
    },
  ];
  const waits = counters
    .filter(({ window, limit }) => window.count >= limit)
    .map(({ window }) =>
      window.oldest ? retryAfterSeconds(window.oldest, now) : 1,
    );
  return waits.length ? Math.max(...waits) : null;
}
