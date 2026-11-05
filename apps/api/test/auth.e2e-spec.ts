import { JwtService } from '@nestjs/jwt';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import request from 'supertest';
import {
  AuthErrorCode,
  ErrorCode,
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
} from '@muayana/shared';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env.validation';
import {
  issuePhotoKey,
  resolveUploadDir,
} from '../src/common/utils/upload-dir.util';
import {
  bearer,
  createEngineer,
  createTestApp,
  type Engineer,
  type TestApp,
} from './helpers/test-app';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;
const LOGIN = '/api/v1/auth/login';
const ME = '/api/v1/auth/me';
const CHANGE_PASSWORD = '/api/v1/auth/change-password';

describe('Auth (e2e)', () => {
  let t: TestApp;
  let engineer: Engineer;

  beforeAll(async () => {
    t = await createTestApp();
    engineer = await createEngineer(t);
  });

  afterAll(async () => {
    await t?.close();
  });

  /** Every test starts with an empty rate-limit window. */
  beforeEach(() => t.clock.advance(WINDOW_MS + 1_000));

  const login = (email: string, password: string) =>
    request(t.http).post(LOGIN).send({ email, password });

  describe('POST /auth/login', () => {
    it('signs in with the right password and returns a token and the user', async () => {
      const res = await login(engineer.email, engineer.password).expect(200);
      expect(res.body.data).toEqual({
        accessToken: expect.any(String),
        user: {
          id: engineer.user.id,
          email: engineer.email,
          name: 'E2E Engineer',
          locale: 'ar',
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('accepts the email in any case and with spaces', async () => {
      await login(
        `  ${engineer.email.toUpperCase()} `,
        engineer.password,
      ).expect(200);
    });

    it('Wrong password → 401, same message as unknown email', async () => {
      const wrong = await login(engineer.email, 'not-the-password').expect(401);
      const unknown = await login('nobody@muayana.test', 'whatever-1').expect(
        401,
      );
      expect(wrong.body.error).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(wrong.body.message).toBe(unknown.body.message);
      expect(wrong.body.error).toBe(unknown.body.error);
    });

    it('Unknown email → 401', async () => {
      const res = await login('ghost@muayana.test', 'some-password').expect(
        401,
      );
      expect(res.body).toMatchObject({
        success: false,
        statusCode: 401,
        error: AuthErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('6th failed login within 15 min from same IP+email → 429', async () => {
      for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
        await login(engineer.email, `wrong-${i}`).expect(401);
        t.clock.advance(60_000);
      }
      const res = await login(engineer.email, 'wrong-again').expect(429);
      expect(res.body.error).toBe(ErrorCode.TOO_MANY_REQUESTS);
      expect(res.body.data.retryAfterSeconds).toBeGreaterThan(0);
      // Blocked even with the right password while the window holds.
      await login(engineer.email, engineer.password).expect(429);
      // Another email from the same IP is not affected.
      await login('someone-else@muayana.test', 'x-password').expect(401);
    });

    it('After the 15-min window passes, login works again', async () => {
      for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
        await login(engineer.email, `wrong-${i}`).expect(401);
      await login(engineer.email, engineer.password).expect(429);

      t.clock.advance(WINDOW_MS - 1_000);
      await login(engineer.email, engineer.password).expect(429);

      t.clock.advance(2_000);
      await login(engineer.email, engineer.password).expect(200);
    });

    it('a successful sign-in resets the failure count', async () => {
      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++)
        await login(engineer.email, `wrong-${i}`).expect(401);
      await login(engineer.email, engineer.password).expect(200);
      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++)
        await login(engineer.email, `wrong-${i}`).expect(401);
      await login(engineer.email, engineer.password).expect(200);
    });

    it('rejects a malformed body with 400', async () => {
      await request(t.http)
        .post(LOGIN)
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400);
      await request(t.http)
        .post(LOGIN)
        .send({ email: engineer.email })
        .expect(400);
    });

    it('No sign-up/register route exists → 404', async () => {
      for (const path of [
        '/api/v1/auth/register',
        '/api/v1/auth/signup',
        '/api/v1/users',
      ]) {
        const res = await request(t.http)
          .post(path)
          .send({ email: 'new@muayana.test', password: 'password-123' });
        expect(res.status).toBe(404);
      }
    });
  });

  describe('the global guard', () => {
    it('Any data route without token → 401', async () => {
      const calls = [
        () => request(t.http).get(ME),
        () => request(t.http).patch(ME).send({ name: 'x' }),
        () =>
          request(t.http)
            .post(CHANGE_PASSWORD)
            .send({ currentPassword: 'a', newPassword: 'abcdefgh' }),
      ];
      for (const call of calls) {
        const res = await call();
        expect(res.status).toBe(401);
        expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
      }
    });

    it('Expired/garbage token → 401', async () => {
      const jwt = t.app.get(JwtService);
      const expired = await jwt.signAsync({
        sub: engineer.user.id,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      const wrongSecret = await jwt.signAsync(
        { sub: engineer.user.id },
        { secret: 'another-secret-that-is-long-enough-123456' },
      );
      const unknownUser = await jwt.signAsync({ sub: randomUUID() });
      for (const token of [
        'garbage',
        'a.b.c',
        expired,
        wrongSecret,
        unknownUser,
      ]) {
        const res = await request(t.http)
          .get(ME)
          .set('Authorization', bearer(token));
        expect(res.status).toBe(401);
        expect(res.body.error).toBe(ErrorCode.UNAUTHORIZED);
      }
    });

    it('a valid token opens /auth/me', async () => {
      const res = await request(t.http)
        .get(ME)
        .set('Authorization', bearer(engineer.token))
        .expect(200);
      expect(res.body.data).toEqual(engineer.user);
    });
  });

  describe('PATCH /auth/me', () => {
    it('updates name and locale', async () => {
      const res = await request(t.http)
        .patch(ME)
        .set('Authorization', bearer(engineer.token))
        .send({ name: '  Eng. Ahmed  ', locale: 'en' })
        .expect(200);
      expect(res.body.data).toMatchObject({ name: 'Eng. Ahmed', locale: 'en' });
      await request(t.http)
        .patch(ME)
        .set('Authorization', bearer(engineer.token))
        .send({ name: 'E2E Engineer', locale: 'ar' })
        .expect(200);
    });

    it('Locale other than ar/en → 400', async () => {
      const res = await request(t.http)
        .patch(ME)
        .set('Authorization', bearer(engineer.token))
        .send({ locale: 'fr' })
        .expect(400);
      expect(res.body.error).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('rejects an empty name and unknown fields', async () => {
      for (const body of [{ name: '   ' }, { email: 'x@y.z' }]) {
        await request(t.http)
          .patch(ME)
          .set('Authorization', bearer(engineer.token))
          .send(body)
          .expect(400);
      }
    });
  });

  describe('POST /auth/change-password', () => {
    const change = (body: object) =>
      request(t.http)
        .post(CHANGE_PASSWORD)
        .set('Authorization', bearer(engineer.token))
        .send(body);

    it('Change password with wrong current → 400; new < 8 chars → 400', async () => {
      const wrong = await change({
        currentPassword: 'not-the-password',
        newPassword: 'a-long-new-password',
      }).expect(400);
      expect(wrong.body.error).toBe(AuthErrorCode.WRONG_PASSWORD);

      const short = await change({
        currentPassword: engineer.password,
        newPassword: 'short7!',
      }).expect(400);
      expect(short.body.error).toBe(ErrorCode.VALIDATION_FAILED);

      // Neither attempt changed anything.
      await login(engineer.email, engineer.password).expect(200);
    });

    it('changes the password: the old one stops working, the new one signs in', async () => {
      const next = `${engineer.password}-next`;
      const res = await change({
        currentPassword: engineer.password,
        newPassword: next,
      }).expect(200);
      expect(res.body.data).toEqual({ ok: true });
      await login(engineer.email, engineer.password).expect(401);
      await login(engineer.email, next).expect(200);
      engineer.password = next;
    });
  });

  describe('/uploads (public photo files)', () => {
    const key = issuePhotoKey(randomUUID(), randomUUID());
    let file: string;

    beforeAll(async () => {
      const config = t.app.get<ConfigService<Env, true>>(ConfigService);
      file = join(
        resolveUploadDir(config.get('UPLOAD_DIR', { infer: true })),
        key,
      );
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    });

    afterAll(async () => {
      await rm(dirname(file), { recursive: true, force: true });
    });

    it('Photo URL (/uploads/...) opens without a token', async () => {
      const res = await request(t.http).get(`/uploads/${key}`).expect(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      // ...while the API itself still refuses a caller without a token.
      await request(t.http).get(ME).expect(401);
    });

    it('a missing file is a 404, and there is no directory listing', async () => {
      await request(t.http)
        .get(`/uploads/issues/${randomUUID()}/x.jpg`)
        .expect(404);
      await request(t.http).get('/uploads/issues/').expect(404);
    });
  });
});
