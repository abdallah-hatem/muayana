// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const jar = { set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => jar }));

const { POST } = await import('./route');

describe('POST /api/auth/login', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://api.test/api/v1');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    jar.set.mockReset();
  });

  it('forwards the client IP to the API so the rate limit sees the browser, not this server', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { success: false, statusCode: 401, error: 'INVALID_CREDENTIALS' },
        { status: 401 },
      ),
    );
    const res = await POST(
      new Request('http://web.test/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.9',
        },
        body: JSON.stringify({ email: 'a@b.test', password: 'x' }),
      }),
    );
    expect(res.status).toBe(401);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/auth/login');
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
      '203.0.113.9',
    );
  });
});
