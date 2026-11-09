import { renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientFetch } from '@/lib/api-client';
import { capturePrefs } from '@/lib/capture-prefs';
import { routeApi } from '@/test-utils/api-mock';
import {
  CAT_ELECTRIC,
  CAT_PLASTER,
  makeWorker,
  ok,
} from '@/test-utils/fixtures';
import { renderWithIntl } from '@/test-utils/render';
import { CaptureSheet } from './capture-sheet';
import type { CaptureLookups } from './use-capture-lookups';
import { useCaptureLookups } from './use-capture-lookups';

vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));

const sayed = makeWorker({
  name: 'Sayed',
  categories: [CAT_PLASTER],
  counts: { ...makeWorker().counts, open: 3 },
});
const handyman = makeWorker({
  name: 'Handyman',
  categories: [CAT_PLASTER, CAT_ELECTRIC],
  counts: { ...makeWorker().counts, open: 0 },
});
const retired = makeWorker({
  name: 'Retired',
  categories: [CAT_PLASTER],
  active: false,
});
const electrician = makeWorker({
  name: 'Mahmoud',
  categories: [CAT_ELECTRIC],
  counts: { ...makeWorker().counts, open: 0 },
});

const lookups = (over: Partial<CaptureLookups> = {}): CaptureLookups => ({
  phase: 'ready',
  categories: [CAT_PLASTER, CAT_ELECTRIC],
  workers: [sayed, handyman, retired, electrician],
  stale: false,
  ...over,
});

function renderSheet(over: Partial<Parameters<typeof CaptureSheet>[0]> = {}) {
  const props = {
    draft: { issueId: 'issue-1', photos: ['blob:one'] },
    lookups: lookups(),
    initialLocation: 'Floor 3',
    addingPhoto: false,
    onAddPhoto: vi.fn(),
    onSave: vi.fn(),
    ...over,
  };
  renderWithIntl(<CaptureSheet {...props} />);
  return props;
}

const options = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('CaptureSheet (N1)', () => {
  afterEach(() => {
    vi.mocked(clientFetch).mockReset();
    window.localStorage.clear();
  });

  it('Contractor picker lists only active contractors of the chosen trade; changing the trade clears a contractor who lacks it', async () => {
    const { onSave } = renderSheet();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: CAT_PLASTER.nameEn! }));
    await user.click(screen.getByRole('combobox'));
    expect(options()).toEqual(['No worker', 'Sayed3 open', 'Handyman0 open']);
    await user.click(screen.getByRole('option', { name: /Sayed/ }));

    // Electrical: Sayed doesn't do it, so he is dropped.
    await user.click(
      screen.getByRole('button', { name: CAT_ELECTRIC.nameEn! }),
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('No worker');
    await user.click(screen.getByRole('combobox'));
    expect(options()).toEqual(['No worker', 'Handyman0 open', 'Mahmoud0 open']);
    await user.click(screen.getByRole('option', { name: /Handyman/ }));

    // Back to plaster: the handyman does both, so he stays.
    await user.click(screen.getByRole('button', { name: CAT_PLASTER.nameEn! }));
    await user.type(screen.getByLabelText('Description'), 'Crack');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      location: 'Floor 3',
      note: 'Crack',
      categoryId: CAT_PLASTER.id,
      workerId: handyman.id,
      priority: 'normal',
    });
  });

  it('Sheet opens with keyboard down (no autofocus); add-photo-to-this-issue before save', async () => {
    const { onAddPhoto, onSave } = renderSheet();
    const sheet = await screen.findByTestId('capture-sheet');
    // Focus sits on the sheet itself: no field is focused, so a phone keeps its keyboard down.
    await waitFor(() => expect(document.activeElement).toBe(sheet));
    expect(document.activeElement?.tagName).not.toMatch(/INPUT|TEXTAREA/);

    await userEvent.setup().click(screen.getByTestId('capture-add-photo'));
    expect(onAddPhoto).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('contractor with no description is held back with the reason; photo only saves no fields', async () => {
    const { onSave } = renderSheet();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: CAT_PLASTER.nameEn! }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Sayed/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText('Write a description to assign a worker.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Photo only' }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('a full issue (10 photos) can take no more', () => {
    renderSheet({
      draft: {
        issueId: 'issue-1',
        photos: Array.from({ length: 10 }, (_, i) => `blob:${i}`),
      },
    });
    expect(screen.getByTestId('capture-add-photo')).toBeDisabled();
  });

  it('stale lists say they may be out of date', () => {
    renderSheet({ lookups: lookups({ stale: true }) });
    expect(screen.getByTestId('capture-lookups-stale')).toHaveTextContent(
      'may be out of date',
    );
  });
});

describe('useCaptureLookups (N1)', () => {
  afterEach(() => {
    vi.mocked(clientFetch).mockReset();
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  it('online: fetches the active trades and contractors and keeps them on the phone', async () => {
    routeApi(clientFetch, {
      'GET /categories': () => ok([CAT_PLASTER]),
      'GET /workers': () => ok([sayed, retired]),
    });
    const { result } = renderHook(() => useCaptureLookups());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current.stale).toBe(false);
    expect(result.current.workers.map((w) => w.name)).toEqual(['Sayed']);
    expect(capturePrefs.cachedCategories()).toEqual([
      {
        id: CAT_PLASTER.id,
        nameAr: CAT_PLASTER.nameAr,
        nameEn: CAT_PLASTER.nameEn,
        color: CAT_PLASTER.color,
      },
    ]);
    expect(capturePrefs.cachedWorkers()?.map((w) => w.id)).toEqual([sayed.id]);
  });

  it('offline: uses the cached trades and contractors, marked stale, and asks nothing', async () => {
    capturePrefs.setCachedCategories([CAT_ELECTRIC]);
    capturePrefs.setCachedWorkers([electrician]);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    const { result } = renderHook(() => useCaptureLookups());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toMatchObject({
      stale: true,
      categories: [{ id: CAT_ELECTRIC.id }],
      workers: [{ id: electrician.id, counts: { open: 0 } }],
    });
    expect(clientFetch).not.toHaveBeenCalled();
  });

  it('an unreachable server falls back to the cached lists', async () => {
    capturePrefs.setCachedCategories([CAT_PLASTER]);
    vi.mocked(clientFetch).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCaptureLookups());
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current).toMatchObject({
      stale: true,
      categories: [{ id: CAT_PLASTER.id }],
      workers: [],
    });
  });
});
