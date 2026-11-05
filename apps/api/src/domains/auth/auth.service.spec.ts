import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import {
  AuthErrorCode,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_PER_EMAIL,
} from '@muayana/shared';
import type { Clock } from '../../common/clock/clock';
import { hashPassword } from '../../common/utils/password.util';
import { AuthService, INVALID_CREDENTIALS_MESSAGE } from './auth.service';
import type {
  AuthUserRepository,
  UserWithHash,
} from './repositories/auth-user.repository';
import { InMemoryLoginAttemptStore } from './repositories/in-memory-login-attempt.store';

const USER_ID = '11111111-1111-4111-8111-111111111111';
let rightHash: string;

beforeAll(async () => {
  rightHash = await hashPassword('right-password');
});

function makeService(overrides: { user?: UserWithHash | null } = {}) {
  const user =
    overrides.user === undefined
      ? {
          id: USER_ID,
          email: 'eng@muayana.test',
          name: 'Eng',
          locale: 'ar' as const,
          passwordHash: rightHash,
        }
      : overrides.user;
  const users = {
    findByEmailWithHash: jest.fn().mockResolvedValue(user),
    findHashById: jest.fn().mockResolvedValue(user?.passwordHash ?? null),
    updatePasswordHash: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  let now = new Date('2026-11-05T12:00:00Z').getTime();
  const clock: Clock = { now: () => new Date(now) };
  const service = new AuthService(
    users as unknown as AuthUserRepository,
    jwt as unknown as JwtService,
    new InMemoryLoginAttemptStore(),
    clock,
  );
  return {
    service,
    users,
    jwt,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const creds = (password: string) => ({ email: 'eng@muayana.test', password });

describe('AuthService', () => {
  jest.setTimeout(30_000);

  it('login returns the token (7 days) and the user without the hash', async () => {
    const { service, jwt } = makeService();
    const res = await service.login(creds('right-password'), '1.1.1.1');
    expect(res).toEqual({
      accessToken: 'signed.jwt.token',
      user: {
        id: USER_ID,
        email: 'eng@muayana.test',
        name: 'Eng',
        locale: 'ar',
      },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: USER_ID },
      { expiresIn: '7d' },
    );
  });

  it('wrong password and unknown email throw the same 401', async () => {
    const known = makeService();
    const unknown = makeService({ user: null });
    const errors = await Promise.all([
      known.service.login(creds('wrong'), '1.1.1.1').catch((e: unknown) => e),
      unknown.service.login(creds('wrong'), '1.1.1.1').catch((e: unknown) => e),
    ]);
    for (const e of errors) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect((e as UnauthorizedException).getResponse()).toEqual({
        message: INVALID_CREDENTIALS_MESSAGE,
        error: AuthErrorCode.INVALID_CREDENTIALS,
      });
    }
  });

  it('locks after the limit without checking the password, then unlocks after the window', async () => {
    const { service, users, advance } = makeService();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
      await expect(
        service.login(creds('wrong'), '1.1.1.1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    users.findByEmailWithHash.mockClear();
    const locked = await service
      .login(creds('right-password'), '1.1.1.1')
      .catch((e: unknown) => e);
    expect((locked as HttpException).getStatus()).toBe(429);
    expect(users.findByEmailWithHash).not.toHaveBeenCalled();
    // Another IP is not locked.
    await expect(
      service.login(creds('right-password'), '2.2.2.2'),
    ).resolves.toBeDefined();
    advance(15 * 60_000 + 1);
    await expect(
      service.login(creds('right-password'), '1.1.1.1'),
    ).resolves.toBeDefined();
  });

  it('locks the email for every IP once the email-only ceiling is reached', async () => {
    const { service } = makeService();
    const ips = LOGIN_MAX_FAILURES_PER_EMAIL / LOGIN_MAX_FAILURES;
    for (let n = 0; n < ips; n++)
      for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
        await expect(
          service.login(creds('wrong'), `10.0.0.${n}`),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    const locked = await service
      .login(creds('right-password'), '10.9.9.9')
      .catch((e: unknown) => e);
    expect((locked as HttpException).getStatus()).toBe(429);
  });

  it('changePassword refuses a wrong current password with WRONG_PASSWORD', async () => {
    const { service, users } = makeService();
    const e = await service
      .changePassword(USER_ID, {
        currentPassword: 'nope',
        newPassword: 'new-password-1',
      })
      .catch((err: unknown) => err);
    expect(e).toBeInstanceOf(BadRequestException);
    expect((e as BadRequestException).getResponse()).toMatchObject({
      error: AuthErrorCode.WRONG_PASSWORD,
    });
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('changePassword stores a new hash, never the plain password', async () => {
    const { service, users } = makeService();
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: 'right-password',
        newPassword: 'new-password-1',
      }),
    ).resolves.toEqual({ ok: true });
    const [, stored] = users.updatePasswordHash.mock.calls[0] as [
      string,
      string,
    ];
    expect(stored).toMatch(/^\$2[aby]\$12\$/);
    expect(stored).not.toContain('new-password-1');
  });
});
