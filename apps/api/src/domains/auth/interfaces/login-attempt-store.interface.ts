/** Failures of one key inside the asked window. */
export interface FailureWindow {
  count: number;
  /** The oldest counted failure, or null when there is none. */
  oldest: Date | null;
}

/**
 * Where failed sign-in attempts are counted. Postgres in the app (every serverless instance sees
 * the same counts); an in-memory version backs the unit tests.
 */
export interface LoginAttemptStore {
  /** Failures for each of `keys` at or after `since`, in one read. A key with none is absent. */
  failuresSince(
    keys: readonly string[],
    since: Date,
  ): Promise<Map<string, FailureWindow>>;
  /**
   * Records one failure at `at` under every key, all or none, and forgets failures older than
   * `pruneBefore` (no key's window reaches back that far).
   */
  recordFailure(
    keys: readonly string[],
    at: Date,
    pruneBefore: Date,
  ): Promise<void>;
  /** Forget every failure for these keys (after a successful sign-in). */
  clear(keys: readonly string[]): Promise<void>;
}

export const LOGIN_ATTEMPT_STORE = Symbol('LOGIN_ATTEMPT_STORE');
