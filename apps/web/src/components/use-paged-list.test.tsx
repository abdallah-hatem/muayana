import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedList } from './use-paged-list';

describe('usePagedList', () => {
  it('leaving the list aborts its pending page request (it must not hold a connection the next page needs)', async () => {
    const fetchPage = vi.fn(
      (_page: number, _limit: number, _signal: AbortSignal) =>
        new Promise<never>(() => undefined),
    );
    const { unmount } = renderHook(() => usePagedList(fetchPage));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    const signal = fetchPage.mock.calls[0][2];
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
