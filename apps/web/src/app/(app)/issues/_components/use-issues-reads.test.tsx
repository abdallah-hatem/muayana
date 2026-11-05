import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParsedIssueFilter } from '@muayana/shared';
import { clientFetch, type ClientFetchOptions } from '@/lib/api-client';
import { useFilterOptions } from './use-filter-options';
import { useIssuesList } from './use-issues-list';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));
const fetchMock = vi.mocked(clientFetch);

/** Every request hangs; returns the signals they were sent with. */
function hangingRequests(): AbortSignal[] {
  const signals: AbortSignal[] = [];
  fetchMock.mockImplementation(
    (_path: string, options: ClientFetchOptions = {}) => {
      if (options.signal) signals.push(options.signal);
      return new Promise(() => undefined);
    },
  );
  return signals;
}

describe('issues screen reads', () => {
  afterEach(() => fetchMock.mockReset());

  it('leaving the issues list aborts its pending filter-option requests (they must not hold the connections the next page needs)', async () => {
    const signals = hangingRequests();
    const { unmount } = renderHook(() => useFilterOptions());
    await waitFor(() => expect(signals).toHaveLength(3));
    expect(signals.some((s) => s.aborted)).toBe(false);
    unmount();
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('leaving the issues list aborts its pending page request', async () => {
    const signals = hangingRequests();
    const { unmount } = renderHook(() =>
      useIssuesList({} as ParsedIssueFilter),
    );
    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0].aborted).toBe(false);
    unmount();
    expect(signals[0].aborted).toBe(true);
  });
});
