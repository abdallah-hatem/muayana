import 'fake-indexeddb/auto';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteProvider } from '@/components/site/site-context';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { renderWithIntl } from '@/test-utils/render';
import { CaptureScreen } from './capture-screen';
import { takeShot } from './capture-shot';
import { importToTray } from './tray/tray-import';

const SITE = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/capture',
}));
vi.mock('@/lib/api-client', () => ({ clientFetch: vi.fn() }));
vi.mock('./tray/tray-import', () => ({ importToTray: vi.fn(async () => {}) }));
vi.mock('./capture-shot', () => ({
  galleryTakenAt: () => new Date(),
  saveCapture: vi.fn(async () => {}),
  takeShot: vi.fn(async () => ({
    item: { kind: 'create' },
    lastIssue: {
      issueId: 'issue-1',
      siteId: '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f',
    },
    photo: new Blob(['x'], { type: 'image/jpeg' }),
  })),
}));
vi.mock('./use-capture-lookups', () => ({
  useCaptureLookups: () => ({
    phase: 'ready',
    categories: [],
    workers: [],
    stale: false,
  }),
}));
vi.mock('./use-capture-sites', async () => {
  const { useSiteSelection } = await import('@/components/site/site-context');
  const sites = [
    { id: '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f', name: 'Tower A' },
  ];
  return {
    useCaptureSites: () => {
      const { siteId, setSiteId } = useSiteSelection();
      return {
        state: { phase: 'ready', sites, stale: false, failed: false },
        site: sites.find((s) => s.id === siteId) ?? null,
        setSiteId,
      };
    },
  };
});

const photos = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => new File(['x'], `p${i}.jpg`, { type: 'image/jpeg' }),
  );

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.setItem(LAST_SITE_KEY, SITE);
});

function renderCapture() {
  return renderWithIntl(
    <SiteProvider>
      <CaptureScreen />
    </SiteProvider>,
  );
}

describe('gallery on the capture page (N6)', () => {
  it('photos picked outside a sheet go to the site’s tray, and the tray opens', async () => {
    renderCapture();
    const user = userEvent.setup();
    const picked = photos(5);
    await act(() => user.upload(screen.getByTestId('gallery-input'), picked));
    expect(importToTray).toHaveBeenCalledWith(picked, SITE);
    expect(push).toHaveBeenCalledWith('/capture/tray');
    expect(takeShot).not.toHaveBeenCalled();
    expect(screen.queryByTestId('capture-sheet')).toBeNull();
  });

  it('a single gallery photo goes to the tray too', async () => {
    renderCapture();
    const user = userEvent.setup();
    await act(() =>
      user.upload(screen.getByTestId('gallery-input'), photos(1)),
    );
    expect(importToTray).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/capture/tray');
  });

  it('inside an open sheet, "From gallery" still adds the photos to that issue', async () => {
    renderCapture();
    const user = userEvent.setup();
    await act(() =>
      user.upload(screen.getByTestId('camera-input'), photos(1)[0]),
    );
    await screen.findByTestId('capture-sheet');
    await user.click(screen.getByTestId('capture-add-from-gallery'));
    // The phone's picker hands the files to the hidden input (no tap on the page behind the sheet).
    const input = screen.getByTestId('gallery-input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: photos(2),
    });
    fireEvent.change(input);
    await waitFor(() => expect(takeShot).toHaveBeenCalledTimes(3));
    expect(
      vi
        .mocked(takeShot)
        .mock.calls.slice(1)
        .map(([input]) => input),
    ).toEqual([
      expect.objectContaining({
        mode: 'attach',
        previous: { issueId: 'issue-1', siteId: SITE },
        draft: true,
      }),
      expect.objectContaining({
        mode: 'attach',
        previous: { issueId: 'issue-1', siteId: SITE },
        draft: true,
      }),
    ]);
    expect(importToTray).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('the page links to the tray', () => {
    renderCapture();
    expect(screen.getByTestId('tray-entry')).toHaveAttribute(
      'href',
      '/capture/tray',
    );
    expect(screen.getByTestId('tray-entry')).toHaveTextContent(
      'Unsorted photos',
    );
  });
});
