import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
} from '@muayana/shared';
import {
  isLoginLocked,
  loginAttemptKey,
  loginWindowStart,
  retryAfterSeconds,
} from './auth.pure';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;

describe('auth.pure', () => {
  it('keys attempts by IP and normalised email', () => {
    expect(loginAttemptKey('1.2.3.4', '  Eng@X.test ')).toBe(
      '1.2.3.4|eng@x.test',
    );
    expect(loginAttemptKey('1.2.3.4', 'a@x.test')).not.toBe(
      loginAttemptKey('5.6.7.8', 'a@x.test'),
    );
  });

  it('the window starts 15 minutes before now', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(now.getTime() - loginWindowStart(now).getTime()).toBe(WINDOW_MS);
  });

  it('locks at the limit, not before', () => {
    expect(isLoginLocked(LOGIN_MAX_FAILURES - 1)).toBe(false);
    expect(isLoginLocked(LOGIN_MAX_FAILURES)).toBe(true);
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
