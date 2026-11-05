import type {
  FailureWindow,
  LoginAttemptStore,
} from '../interfaces/login-attempt-store.interface';

/** Failure timestamps per key, for unit tests (one process only: the app uses Postgres). */
export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly failures = new Map<string, number[]>();

  failuresSince(
    keys: readonly string[],
    since: Date,
  ): Promise<Map<string, FailureWindow>> {
    const result = new Map<string, FailureWindow>();
    for (const key of keys) {
      const recent = (this.failures.get(key) ?? []).filter(
        (t) => t >= since.getTime(),
      );
      if (recent.length)
        result.set(key, {
          count: recent.length,
          oldest: new Date(Math.min(...recent)),
        });
    }
    return Promise.resolve(result);
  }

  recordFailure(
    keys: readonly string[],
    at: Date,
    pruneBefore: Date,
  ): Promise<void> {
    for (const [key, list] of this.failures) {
      const kept = list.filter((t) => t >= pruneBefore.getTime());
      if (kept.length) this.failures.set(key, kept);
      else this.failures.delete(key);
    }
    for (const key of keys)
      this.failures.set(key, [...(this.failures.get(key) ?? []), at.getTime()]);
    return Promise.resolve();
  }

  clear(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.failures.delete(key);
    return Promise.resolve();
  }
}
