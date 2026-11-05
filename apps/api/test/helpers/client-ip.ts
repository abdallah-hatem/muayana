import request from 'supertest';
import { ErrorCode, LOGIN_MAX_FAILURES } from '@muayana/shared';
import { createEngineer, createTestApp, type TestApp } from './test-app';

const LOGIN = '/api/v1/auth/login';
const CLIENT_A = '203.0.113.10';
const CLIENT_B = '203.0.113.20';

/**
 * The sign-in rate limit's view of the caller's IP. The web proxy forwards the browser's IP in
 * X-Forwarded-For; the API believes it only with TRUST_PROXY=true.
 */
export function describeClientIp(trusted: boolean): void {
  describe(`Login rate limit client IP (TRUST_PROXY=${trusted})`, () => {
    let t: TestApp;
    let email: string;

    beforeAll(async () => {
      t = await createTestApp();
      email = (await createEngineer(t)).email;
    });
    afterAll(async () => {
      await t?.close();
    });

    const fail = (clientIp: string) =>
      request(t.http)
        .post(LOGIN)
        .set('X-Forwarded-For', clientIp)
        .send({ email, password: 'wrong-password' });

    const title = trusted
      ? 'counts failures per forwarded client IP: another client is not blocked'
      : 'ignores X-Forwarded-For: changing it does not escape the limit';

    it(title, async () => {
      for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
        await fail(CLIENT_A).expect(401);
      const blocked = await fail(CLIENT_A).expect(429);
      expect(blocked.body.error).toBe(ErrorCode.TOO_MANY_REQUESTS);

      await fail(CLIENT_B).expect(trusted ? 401 : 429);
    });
  });
}
