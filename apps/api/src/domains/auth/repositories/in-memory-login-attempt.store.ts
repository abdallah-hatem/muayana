import { Injectable } from '@nestjs/common';
import type { LoginAttemptStore } from '../interfaces/login-attempt-store.interface';

/** Failure timestamps per key, pruned of anything older than the asked window as it is read. */
@Injectable()
export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly failures = new Map<string, number[]>();

  countFailuresSince(key: string, since: Date): Promise<number> {
    return Promise.resolve(this.recent(key, since).length);
  }

  oldestFailureSince(key: string, since: Date): Promise<Date | null> {
    const first = this.recent(key, since)[0];
    return Promise.resolve(first === undefined ? null : new Date(first));
  }

  recordFailure(key: string, at: Date): Promise<void> {
    const list = this.failures.get(key) ?? [];
    list.push(at.getTime());
    this.failures.set(key, list);
    return Promise.resolve();
  }

  clear(key: string): Promise<void> {
    this.failures.delete(key);
    return Promise.resolve();
  }

  private recent(key: string, since: Date): number[] {
    const list = (this.failures.get(key) ?? []).filter(
      (t) => t >= since.getTime(),
    );
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }
}
