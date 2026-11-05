import { InMemoryLoginAttemptStore } from './in-memory-login-attempt.store';

describe('InMemoryLoginAttemptStore', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 12, minute));

  it('counts only failures inside the asked window, per key', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure('a', at(0));
    await store.recordFailure('a', at(10));
    await store.recordFailure('b', at(10));
    expect(await store.countFailuresSince('a', at(0))).toBe(2);
    expect(await store.countFailuresSince('a', at(5))).toBe(1);
    expect(await store.oldestFailureSince('a', at(5))).toEqual(at(10));
    expect(await store.countFailuresSince('b', at(0))).toBe(1);
  });

  it('clear forgets a key', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure('a', at(0));
    await store.clear('a');
    expect(await store.countFailuresSince('a', at(0))).toBe(0);
    expect(await store.oldestFailureSince('a', at(0))).toBeNull();
  });
});
