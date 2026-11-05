// Must stay the first import: sets TRUST_PROXY before AppModule is loaded, so each test can
// pick the caller's IP with X-Forwarded-For.
import './helpers/setup-trust-proxy';
import request from 'supertest';
import {
  ErrorCode,
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_PER_EMAIL,
} from '@muayana/shared';
import { createEngineer, createTestApp, type TestApp } from './helpers/test-app';

const WINDOW_MS = LOGIN_FAILURE_WINDOW_MINUTES * 60_000;
const LOGIN = '/api/v1/auth/login';
const EMAIL = 'limit-e2e@muayana.test';

/**
 * The sign-in rate limit kept in Postgres: two API instances (as two serverless functions would
 * be) share one count, an email-only ceiling holds across IPs, and the window still expires.
 */
describe('Login rate limit shared through the database (e2e)', () => {
  let a: TestApp;
  let b: TestApp;
  let password: string;

  beforeAll(async () => {
    a = await createTestApp();
    b = await createTestApp({ resetLoginLimit: false });
    password = (await createEngineer(a, { email: EMAIL })).password;
  });

  afterAll(async () => {
    await a?.close();
    await b?.close();
  });

  /** Both instances' clocks move together; every test starts with an empty window. */
  const advance = (ms: number) => {
    a.clock.advance(ms);
    b.clock.advance(ms);
  };
  beforeEach(() => advance(WINDOW_MS + 1_000));

  const login = (t: TestApp, ip: string, pass = 'wrong-password') =>
    request(t.http)
      .post(LOGIN)
      .set('X-Forwarded-For', ip)
      .send({ email: EMAIL, password: pass });

  it('limit holds across two app instances sharing the DB', async () => {
    const ip = '198.51.100.1';
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
      await login(i % 2 ? b : a, ip).expect(401);

    for (const t of [a, b]) {
      const res = await login(t, ip, password).expect(429);
      expect(res.body.error).toBe(ErrorCode.TOO_MANY_REQUESTS);
      expect(res.body.data.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('email-only ceiling: failures spread over many IPs lock the email for every IP', async () => {
    const ips = LOGIN_MAX_FAILURES_PER_EMAIL / LOGIN_MAX_FAILURES;
    for (let n = 0; n < ips; n++)
      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++)
        await login(n % 2 ? b : a, `198.51.100.${10 + n}`).expect(401);
    // Each IP is still under its own limit, so the per-IP rule alone would let these through.
    const remaining =
      LOGIN_MAX_FAILURES_PER_EMAIL - ips * (LOGIN_MAX_FAILURES - 1);
    for (let i = 0; i < remaining; i++)
      await login(a, `198.51.100.${50 + i}`).expect(401);

    const res = await login(b, '198.51.100.99', password).expect(429);
    expect(res.body.error).toBe(ErrorCode.TOO_MANY_REQUESTS);
    expect(res.body.data.retryAfterSeconds).toBeGreaterThan(0);
    // A missing X-Forwarded-For doesn't escape it either.
    await request(a.http)
      .post(LOGIN)
      .send({ email: EMAIL, password })
      .expect(429);
    // Another email is untouched.
    await request(a.http)
      .post(LOGIN)
      .set('X-Forwarded-For', '198.51.100.99')
      .send({ email: 'someone-else@muayana.test', password: 'x-password' })
      .expect(401);
  });

  it('window expiry with the injectable clock: the lock lifts and old rows are pruned', async () => {
    const ip = '198.51.100.2';
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++)
      await login(a, ip).expect(401);
    await login(b, ip, password).expect(429);

    advance(WINDOW_MS - 1_000);
    await login(b, ip, password).expect(429);

    advance(2_000);
    // A failure from another IP prunes everything older than the window...
    await login(a, '198.51.100.3').expect(401);
    const since = new Date(a.clock.now().getTime() - WINDOW_MS);
    expect(await a.db.loginFailure.count({ where: { at: { lt: since } } })).toBe(
      0,
    );
    // ...and the locked IP signs in again, on either instance.
    await login(b, ip, password).expect(200);
  });
});
