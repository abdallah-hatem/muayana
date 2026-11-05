// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { clientIp, forwardToApi, upstreamUrl } = await import('./api-proxy');

const API = 'http://api.test/api/v1';

describe('forwardToApi', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('API_URL', API);
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('builds the upstream URL from the segments and the query', () => {
    expect(upstreamUrl(['issues', 'a b'], '?status=new')).toBe(
      `${API}/issues/a%20b?status=new`,
    );
  });

  it('adds the bearer token and never forwards the browser cookies', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true, data: 1 }));
    await forwardToApi(
      new Request('http://web.test/api/proxy/auth/me', {
        headers: { cookie: 'muayana_session=secret', 'accept-language': 'ar' },
      }),
      ['auth', 'me'],
      'tok',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth/me`);
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('accept-language')).toBe('ar');
    expect(headers.get('cookie')).toBeNull();
  });

  it('streams a multipart upload through untouched', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: true }, { status: 201 }),
    );
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
      'a.jpg',
    );
    const original = new Request('http://web.test/api/proxy/issues/x/photos', {
      method: 'POST',
      body: form,
    });
    const contentType = original.headers.get('content-type')!;
    const expectedBytes = new Uint8Array(await original.clone().arrayBuffer());

    const res = await forwardToApi(original, ['issues', 'x', 'photos'], 'tok');

    expect(res.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('content-type')).toBe(contentType);
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(init?.body).toBeInstanceOf(ReadableStream);
    expect((init as { duplex?: string }).duplex).toBe('half');
    const sent = new Uint8Array(
      await new Response(init?.body as ReadableStream).arrayBuffer(),
    );
    expect(sent).toEqual(expectedBytes);
  });

  it('streams a CSV download back with its type and file name', async () => {
    const csv = '﻿number,status\n1,new\n';
    fetchMock.mockResolvedValue(
      new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="issues.csv"',
          'content-encoding': 'gzip',
        },
      }),
    );
    const res = await forwardToApi(
      new Request('http://web.test/api/proxy/issues/export.csv?site=1'),
      ['issues', 'export.csv'],
      'tok',
    );
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/issues/export.csv?site=1`);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="issues.csv"',
    );
    // fetch already decoded the body: the encoding header must not claim otherwise.
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new TextEncoder().encode(csv),
    );
  });

  it('passes the API status through (401 stays 401)', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: false }, { status: 401 }),
    );
    const res = await forwardToApi(
      new Request('http://web.test/x'),
      ['auth', 'me'],
      undefined,
    );
    expect(res.status).toBe(401);
  });

  it('answers 502 NETWORK_ERROR when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await forwardToApi(
      new Request('http://web.test/x'),
      ['auth', 'me'],
      'tok',
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'NETWORK_ERROR' });
  });

  it('forwards the client IP (first X-Forwarded-For entry) as X-Forwarded-For', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    await forwardToApi(
      new Request('http://web.test/api/auth/login', {
        method: 'POST',
        body: '{}',
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      }),
      ['auth', 'login'],
      undefined,
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
      '203.0.113.7',
    );
  });

  it('sends no X-Forwarded-For when the client IP is unknown', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    await forwardToApi(new Request('http://web.test/x'), ['auth', 'me'], 'tok');
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBeNull();
  });
});

describe('clientIp', () => {
  it('falls back to X-Real-IP', () => {
    expect(
      clientIp(
        new Request('http://web.test/', {
          headers: { 'x-real-ip': ' 198.51.100.2 ' },
        }),
      ),
    ).toBe('198.51.100.2');
  });
});
