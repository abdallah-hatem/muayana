import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import type { App } from 'supertest/types';
import request from 'supertest';
import type { LoginResponse, User } from '@muayana/shared';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CLOCK, type Clock } from '../../src/common/clock/clock';
import { hashPassword } from '../../src/common/utils/password.util';
import { DatabaseService } from '../../src/database/database.service';

/** A clock the test moves by hand (the sign-in window, overdue dates). */
export class FakeClock implements Clock {
  private ms: number;

  constructor(start: Date = new Date()) {
    this.ms = start.getTime();
  }

  now(): Date {
    return new Date(this.ms);
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}

export interface TestApp {
  app: INestApplication<App>;
  /** `request(http)` — supertest against the in-process server (no port needed). */
  http: App;
  db: DatabaseService;
  clock: FakeClock;
  close(): Promise<void>;
}

/**
 * The whole app as main.ts wires it, with a FakeClock in place of the system clock. The sign-in
 * rate limit lives in the database, so a new app starts from an empty `login_failures` table
 * (earlier suites' FakeClocks ran ahead of this one); pass `resetLoginLimit: false` for a second
 * instance that must share the first one's counts.
 */
export async function createTestApp({
  resetLoginLimit = true,
} = {}): Promise<TestApp> {
  const clock = new FakeClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  const db = app.get(DatabaseService);
  if (resetLoginLimit) await db.loginFailure.deleteMany();
  return {
    app,
    http: app.getHttpServer(),
    db,
    clock,
    close: () => app.close(),
  };
}

export const TEST_ENGINEER_EMAIL = 'e2e-engineer@muayana.test';

export interface Engineer {
  user: User;
  email: string;
  /** A fresh random password for this run; never a real credential. */
  password: string;
  /** A valid bearer token for the engineer. */
  token: string;
}

/**
 * Creates (or resets) the engineer account and signs in through POST /auth/login. Later tasks
 * call this in beforeAll and send `Authorization: Bearer ${engineer.token}`.
 */
export async function createEngineer(
  t: TestApp,
  { email = TEST_ENGINEER_EMAIL, name = 'E2E Engineer' } = {},
): Promise<Engineer> {
  const password = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(password);
  await t.db.user.upsert({
    where: { email },
    create: { email, name, passwordHash, locale: 'ar' },
    update: { name, passwordHash, locale: 'ar' },
  });
  const res = await request(t.http)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const data = (res.body as { data: LoginResponse }).data;
  return { user: data.user, email, password, token: data.accessToken };
}

/** `Authorization` header value for a token. */
export const bearer = (token: string): string => `Bearer ${token}`;
