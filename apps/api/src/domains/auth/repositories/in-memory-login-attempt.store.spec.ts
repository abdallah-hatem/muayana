import { InMemoryLoginAttemptStore } from './in-memory-login-attempt.store';

describe('InMemoryLoginAttemptStore', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 12, minute));
  const EPOCH = new Date(0);

  it('counts only failures inside the asked window, per key', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure(['a'], at(0), EPOCH);
    await store.recordFailure(['a', 'b'], at(10), EPOCH);
    expect(await store.failuresSince(['a', 'b'], at(0))).toEqual(
      new Map([
        ['a', { count: 2, oldest: at(0) }],
        ['b', { count: 1, oldest: at(10) }],
      ]),
    );
    expect((await store.failuresSince(['a'], at(5))).get('a')).toEqual({
      count: 1,
      oldest: at(10),
    });
  });

  it('prunes failures older than pruneBefore when recording', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure(['a'], at(0), EPOCH);
    await store.recordFailure(['b'], at(20), at(5));
    expect((await store.failuresSince(['a'], EPOCH)).has('a')).toBe(false);
  });

  it('clear forgets the keys', async () => {
    const store = new InMemoryLoginAttemptStore();
    await store.recordFailure(['a', 'b'], at(0), EPOCH);
    await store.clear(['a', 'b']);
    expect((await store.failuresSince(['a', 'b'], EPOCH)).size).toBe(0);
  });
});
