/**
 * Where failed sign-in attempts are counted. In memory today (one engineer, one API instance);
 * a shared store (Postgres, Redis) can replace it behind this interface without touching the rule.
 */
export interface LoginAttemptStore {
  /** Failures recorded for `key` at or after `since`. */
  countFailuresSince(key: string, since: Date): Promise<number>;
  /** The oldest failure for `key` at or after `since`, or null. */
  oldestFailureSince(key: string, since: Date): Promise<Date | null>;
  recordFailure(key: string, at: Date): Promise<void>;
  /** Forget every failure for `key` (after a successful sign-in). */
  clear(key: string): Promise<void>;
}

export const LOGIN_ATTEMPT_STORE = Symbol('LOGIN_ATTEMPT_STORE');
