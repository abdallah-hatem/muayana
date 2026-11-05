import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientFetch, READ_TIMEOUT_MS } from './api-client';

/** A fetch that never answers, the way a stalled proxy or API behaves; it only ends on abort. */
function hangingFetch(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
    });
}

describe('clientFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('a read that never answers fails as a network error after the read timeout (no screen stuck loading)', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hangingFetch());
    const result = clientFetch('/sites');
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await expect(result).resolves.toMatchObject({
      success: false,
      status: 0,
    });
  });

  it("aborting the caller's signal releases a pending read at once", async () => {
    fetchMock.mockImplementation(hangingFetch());
    const controller = new AbortController();
    const result = clientFetch('/sites', { signal: controller.signal });
    controller.abort();
    await expect(result).resolves.toMatchObject({
      success: false,
      status: 0,
    });
  });

  it('a write has no read timeout (an upload on a slow line is not abandoned)', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ success: true, data: { id: 'x' } }, { status: 201 }),
    );
    await clientFetch('/issues', { method: 'POST', body: { a: 1 } });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeUndefined();
  });
});
