import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch, type ClientFetchOptions } from '@/lib/api-client';
import {
  SiteProvider,
  useSiteSelection,
} from '@/components/site/site-context';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { makeSite, ok } from '@/test-utils/fixtures';
import { useCaptureSites } from './use-capture-sites';

// Capture runs inside the app's one site selection (the top-bar switcher shares it).
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SiteProvider>{children}</SiteProvider>
);
const render = () =>
  renderHook(() => ({ capture: useCaptureSites(), app: useSiteSelection() }), {
    wrapper,
  });

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
    const { result } = render();
    await waitFor(() => expect(result.current.capture.state.phase).toBe('ready'));
    await waitFor(() => expect(result.current.capture.site?.id).toBe(palm.id));
    expect(result.current.app.siteId).toBe(palm.id);
  });

  it('a sites request that throws ends in the failed state, never stuck loading', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const { result } = render();
    await waitFor(() =>
      expect(result.current.capture.state).toMatchObject({
        phase: 'ready',
        failed: true,
      }),
    );
  });

  it('an answer that is not a list ends in the failed state, never stuck loading', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }) as never);
    const { result } = render();
    await waitFor(() =>
      expect(result.current.capture.state).toMatchObject({
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
    const { unmount } = render();
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('the top-bar switcher and capture share one site: changing either changes the other', async () => {
    const palm = makeSite({ name: 'Palm Tower' });
    const nile = makeSite({ name: 'Nile Villas' });
    window.localStorage.setItem(LAST_SITE_KEY, palm.id);
    fetchMock.mockResolvedValue(ok([palm, nile]));
    const { result } = render();
    await waitFor(() => expect(result.current.capture.site?.id).toBe(palm.id));

    act(() => result.current.app.setSiteId(nile.id));
    expect(result.current.capture.site?.id).toBe(nile.id);

    act(() => result.current.capture.setSiteId(palm.id));
    expect(result.current.app.siteId).toBe(palm.id);
    expect(window.localStorage.getItem(LAST_SITE_KEY)).toBe(palm.id);
  });
});
