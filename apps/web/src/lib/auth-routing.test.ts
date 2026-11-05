// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { authRouting, PATHNAME_HEADER } from './auth-routing';
import { loginUrlFor, safeNext } from './routes';
import { SESSION_COOKIE } from './session-cookie';

const NOW = Date.UTC(2026, 10, 5, 12);

/** An unsigned JWT-shaped token: the proxy only reads `exp`. */
function token(expSeconds: number): string {
  const part = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part({ sub: 'u', exp: expSeconds })}.sig`;
}
const LIVE = token(NOW / 1000 + 3600);
const EXPIRED = token(NOW / 1000 - 60);

function visit(path: string, cookie?: string) {
  const req = new NextRequest(new URL(path, 'http://localhost:3113'));
  if (cookie) req.cookies.set(SESSION_COOKIE, cookie);
  return authRouting(req, NOW);
}

const location = (res: Response) => {
  const raw = res.headers.get('location');
  return raw ? new URL(raw).pathname + new URL(raw).search : null;
};

describe('authRouting', () => {
  it('Web: unauthenticated visit to /issues → redirect to /login', () => {
    const res = visit('/issues');
    expect(res.status).toBe(307);
    expect(location(res)).toBe('/login?next=%2Fissues');
  });

  it('keeps the query string in the return path', () => {
    expect(location(visit('/issues?status=new'))).toBe(
      `/login?next=${encodeURIComponent('/issues?status=new')}`,
    );
  });

  it('an expired or garbage cookie counts as signed out, and is cleared', () => {
    for (const cookie of [EXPIRED, 'garbage', 'a.b.c']) {
      const res = visit('/workers', cookie);
      expect(location(res)).toBe('/login?next=%2Fworkers');
      expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
    }
  });

  it('a live token renders the page and passes the path on', () => {
    const res = visit('/inbox', LIVE);
    expect(location(res)).toBeNull();
    expect(res.headers.get(`x-middleware-request-${PATHNAME_HEADER}`)).toBe(
      '/inbox',
    );
  });

  it('signed in on /login → home; signed out → the login page renders', () => {
    expect(location(visit('/login', LIVE))).toBe('/');
    expect(location(visit('/login'))).toBeNull();
  });

  it('the design preview stays public', () => {
    expect(location(visit('/design'))).toBeNull();
  });
});

describe('safeNext / loginUrlFor', () => {
  it('only keeps same-site paths', () => {
    expect(safeNext('/issues?x=1')).toBe('/issues?x=1');
    for (const bad of [
      null,
      '',
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/login',
      '/login?next=/x',
    ])
      expect(safeNext(bad)).toBe('/');
  });

  it('home needs no next param', () => {
    expect(loginUrlFor('/')).toBe('/login');
    expect(loginUrlFor('//evil.test')).toBe('/login');
  });
});
