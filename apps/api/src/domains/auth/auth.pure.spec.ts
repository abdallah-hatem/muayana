import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_PER_EMAIL,
} from '@muayana/shared';
import {
  loginAttemptKeys,
  loginLockedFor,
  loginWindowStart,
  retryAfterSeconds,
} from './auth.pure';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;

describe('auth.pure', () => {
  it('keys attempts by IP and normalised email, plus one email-only key', () => {
    expect(loginAttemptKeys('1.2.3.4', '  Eng@X.test ')).toEqual({
      perIp: 'ip:1.2.3.4|eng@x.test',
      perEmail: 'email:eng@x.test',
    });
    const a = loginAttemptKeys('1.2.3.4', 'a@x.test');
    const b = loginAttemptKeys('5.6.7.8', 'a@x.test');
    expect(a.perIp).not.toBe(b.perIp);
    expect(a.perEmail).toBe(b.perEmail);
  });

  it('a caller with no IP shares the unknown bucket for that email', () => {
    expect(loginAttemptKeys(undefined, 'a@x.test').perIp).toBe(
      'ip:unknown|a@x.test',
    );
    expect(loginAttemptKeys('', 'a@x.test').perIp).toBe('ip:unknown|a@x.test');
  });

  it('the window starts 15 minutes before now', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(now.getTime() - loginWindowStart(now).getTime()).toBe(WINDOW_MS);
  });

  describe('loginLockedFor', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

    it('per-IP limit: locks at the limit, not before', () => {
      expect(
        loginLockedFor(
          { perIp: { count: LOGIN_MAX_FAILURES - 1, oldest: ago(1) } },
          now,
        ),
      ).toBeNull();
      expect(
        loginLockedFor(
          { perIp: { count: LOGIN_MAX_FAILURES, oldest: ago(5) } },
          now,
        ),
      ).toBe(10 * 60);
    });

    it('email-only ceiling: locks at its own limit whatever the per-IP count', () => {
      expect(
        loginLockedFor(
          {
            perIp: { count: 1, oldest: ago(1) },
            perEmail: { count: LOGIN_MAX_FAILURES_PER_EMAIL - 1, oldest: ago(9) },
          },
          now,
        ),
      ).toBeNull();
      expect(
        loginLockedFor(
          { perEmail: { count: LOGIN_MAX_FAILURES_PER_EMAIL, oldest: ago(9) } },
          now,
        ),
      ).toBe(6 * 60);
    });

    it('both locked: the longer wait wins', () => {
      expect(
        loginLockedFor(
          {
            perIp: { count: LOGIN_MAX_FAILURES, oldest: ago(10) },
            perEmail: { count: LOGIN_MAX_FAILURES_PER_EMAIL, oldest: ago(2) },
          },
          now,
        ),
      ).toBe(13 * 60);
    });

    it('no failures at all is not locked', () => {
      expect(loginLockedFor({}, now)).toBeNull();
    });
  });

  it('retry-after counts down to the oldest failure leaving the window, at least 1 s', () => {
    const oldest = new Date('2026-11-05T12:00:00Z');
    expect(retryAfterSeconds(oldest, new Date(oldest.getTime() + 60_000))).toBe(
      WINDOW_MS / 1000 - 60,
    );
    expect(
      retryAfterSeconds(oldest, new Date(oldest.getTime() + WINDOW_MS + 5)),
    ).toBe(1);
  });
});
