import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch, type ClientFetchOptions } from '@/lib/api-client';
import { makeSite, ok } from '@/test-utils/fixtures';
import { useCaptureSites } from './use-capture-sites';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));
const fetchMock = vi.mocked(clientFetch);

describe('useCaptureSites', () => {
  afterEach(() => {
    fetchMock.mockReset();
    window.localStorage.clear();
  });

  it('loads the active sites and preselects the only one', async () => {
    const palm = makeSite({ name: 'Palm Tower' });
    fetchMock.mockResolvedValue(ok([palm]));
    const { result } = renderHook(() => useCaptureSites());
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(result.current.site?.id).toBe(palm.id);
  });

  it('a sites request that throws ends in the failed state, never stuck loading', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCaptureSites());
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        phase: 'ready',
        failed: true,
      }),
    );
  });

  it('an answer that is not a list ends in the failed state, never stuck loading', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }) as never);
    const { result } = renderHook(() => useCaptureSites());
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        phase: 'ready',
        failed: true,
      }),
    );
  });

  it('leaving capture aborts its pending sites request (it must not hold a connection the next page needs)', async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_path: string, options: ClientFetchOptions = {}) => {
        signal = options.signal ?? undefined;
        return new Promise(() => undefined);
      },
    );
    const { unmount } = renderHook(() => useCaptureSites());
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
