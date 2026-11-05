import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
  normalizeEmail,
} from '@muayana/shared';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;

/** The rate-limit key: one counter per caller IP and email (normalised, so case doesn't dodge it). */
export function loginAttemptKey(ip: string, email: string): string {
  return `${ip}|${normalizeEmail(email)}`;
}

/** Failures at or after this instant count toward the limit. */
export function loginWindowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_MS);
}

/** True when the failures inside the window already reach the limit: the attempt gets 429. */
export function isLoginLocked(failuresInWindow: number): boolean {
  return failuresInWindow >= LOGIN_MAX_FAILURES;
}

/** Whole seconds until the oldest counted failure leaves the window (the Retry-After value). */
export function retryAfterSeconds(oldestFailure: Date, now: Date): number {
  const until = oldestFailure.getTime() + WINDOW_MS - now.getTime();
  return Math.max(1, Math.ceil(until / 1000));
}
