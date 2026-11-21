import 'fake-indexeddb/auto';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { toast } from 'sonner';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { SiteProvider } from '@/components/site/site-context';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { closeQueueDb, listItems } from '@/lib/offline-queue';
import { addToTray, listTray, resetTraySnapshot } from '@/lib/photo-tray';
import { renderWithIntl } from '@/test-utils/render';
import { clearImportNotice } from './tray-import';
import { TrayScreen } from './tray-screen';

vi.mock('@/lib/compress-photo', () => ({
  compressPhoto: async (file: Blob) => ({ blob: file, width: 0, height: 0 }),
  PhotoUnreadableError: class extends Error {},
}));
vi.mock('@/lib/api-client', () => ({
  clientFetch: vi.fn(async () => ({ success: false, status: 0 })),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));
vi.mock('../use-capture-lookups', () => ({
  useCaptureLookups: () => ({
    phase: 'ready',
    categories: [],
    workers: [],
    stale: false,
  }),
}));
// The sites the phone knows; the chosen one is the app's site selection, as in the real hook.
vi.mock('../use-capture-sites', async () => {
  const { useSiteSelection } = await import('@/components/site/site-context');
  const sites = [
    { id: '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f', name: 'Tower A' },
    { id: '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e', name: 'Tower B' },
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

const SITE_A = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
const SITE_B = '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e';

/** Gallery files whose one byte is their number. */
const files = (...ns: number[]) =>
  ns.map(
    (n) => new File([new Uint8Array([n])], `p${n}.jpg`, { type: 'image/jpeg' }),
  );
const byteOf = (bytes: ArrayBuffer) => new Uint8Array(bytes)[0];

let urlCount = 0;
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => `blob:test-${++urlCount}`);
  URL.revokeObjectURL = vi.fn();
});

beforeEach(async () => {
  await closeQueueDb();
  globalThis.indexedDB = new IDBFactory();
  resetTraySnapshot();
  clearImportNotice();
  // Nothing uploads during these tests: the queue keeps what the tray hands it.
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderTray(siteId: string | null) {
  if (siteId) window.localStorage.setItem(LAST_SITE_KEY, siteId);
  return renderWithIntl(
    <SiteProvider>
      <TrayScreen />
    </SiteProvider>,
  );
}

const tiles = () => screen.findAllByTestId('tray-photo');
const picksShown = () =>
  screen
    .getAllByTestId('tray-photo')
    .map((tile) => tile.getAttribute('data-pick'));

describe('tray screen (N6)', () => {
  it('shows the chosen site’s tray, by import day, with the import tile first', async () => {
    await addToTray(files(1, 2), SITE_A);
    await addToTray(files(3), SITE_B);
    renderTray(SITE_A);
    expect(await tiles()).toHaveLength(2);
    const group = screen.getByTestId('tray-group');
    expect(within(group).getByText(/^Today · /)).toBeInTheDocument();
    expect(within(group).getByText('2 photos')).toBeInTheDocument();
    expect(within(group).getAllByRole('listitem')[0]).toContainElement(
      screen.getByTestId('tray-import'),
    );
  });

  it('"All sites" shows every site’s photos', async () => {
    await addToTray(files(1, 2), SITE_A);
    await addToTray(files(3), SITE_B);
    renderTray(null);
    expect(await tiles()).toHaveLength(3);
  });

  it('an empty tray says so and offers the import', async () => {
    renderTray(SITE_A);
    expect(await screen.findByText('No unsorted photos')).toBeInTheDocument();
    expect(screen.getByTestId('tray-import-empty')).toBeInTheDocument();
  });

  it('numbers the picks in tap order; unpicking renumbers the rest', async () => {
    await addToTray(files(1, 2, 3, 4), SITE_A);
    renderTray(SITE_A);
    const user = userEvent.setup();
    const [a, b, c] = await tiles();
    await user.click(c);
    await user.click(a);
    await user.click(b);
    expect(picksShown()).toEqual(['2', '3', '1', null]);
    expect(screen.getByTestId('tray-selected')).toHaveTextContent(
      '3 photos picked',
    );
    expect(screen.getByTestId('tray-create')).toHaveTextContent(
      'Make an issue from 3 photos',
    );
    await user.click(a);
    expect(picksShown()).toEqual([null, '2', '1', null]);
    expect(a).toHaveAttribute('aria-pressed', 'false');
  });

  it('an 11th photo is not picked, with a short message', async () => {
    await addToTray(files(...Array.from({ length: 11 }, (_, i) => i)), SITE_A);
    renderTray(SITE_A);
    const user = userEvent.setup();
    for (const tile of await tiles()) await user.click(tile);
    expect(picksShown().filter(Boolean)).toHaveLength(10);
    expect(picksShown()[10]).toBeNull();
    expect(toast.warning).toHaveBeenCalledWith(
      'An issue takes 10 photos at most.',
      expect.anything(),
    );
  });

  it('makes one issue of the picks, in pick order; they leave the tray and the rest stay', async () => {
    await addToTray(files(1, 2, 3, 4, 5), SITE_A);
    renderTray(SITE_A);
    const user = userEvent.setup();
    const all = await tiles();
    await user.click(all[1]);
    await user.click(all[0]);
    await user.click(all[4]);
    await user.click(screen.getByTestId('tray-create'));

    const sheet = await screen.findByTestId('capture-sheet');
    expect(
      within(sheet).getAllByRole('img', { name: /of this issue/ }),
    ).toHaveLength(3);
    // The tray's sheet adds nothing: its photos are the picked ones.
    expect(within(sheet).queryByTestId('capture-add-photo')).toBeNull();
    await user.type(within(sheet).getByLabelText('Location'), 'Lobby');
    await user.click(within(sheet).getByTestId('capture-save'));

    await waitFor(async () => expect(await listTray(SITE_A)).toHaveLength(2));
    const items = await listItems();
    expect(items.map((i) => [i.kind, byteOf(i.photo.bytes)])).toEqual([
      ['create', 2],
      ['addPhoto', 1],
      ['addPhoto', 5],
    ]);
    expect(new Set(items.map((i) => i.issueId)).size).toBe(1);
    expect(items[0]).toMatchObject({ siteId: SITE_A, location: 'Lobby' });
    expect(await tiles()).toHaveLength(2);
    expect(screen.queryByTestId('tray-actions')).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(
      'Issue saved. It uploads by itself.',
    );
  });

  it('closing the sheet makes no issue: the photos stay picked in the tray', async () => {
    await addToTray(files(1, 2), SITE_A);
    renderTray(SITE_A);
    const user = userEvent.setup();
    await user.click((await tiles())[0]);
    await user.click(screen.getByTestId('tray-create'));
    await screen.findByTestId('capture-sheet');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByTestId('capture-sheet')).toBeNull(),
    );
    expect(await listItems()).toEqual([]);
    expect(await listTray(SITE_A)).toHaveLength(2);
    expect(picksShown()).toEqual(['1', null]);
  });

  it('"All sites": the site is asked before the sheet opens', async () => {
    await addToTray(files(1), null);
    renderTray(null);
    const user = userEvent.setup();
    await user.click((await tiles())[0]);
    await user.click(screen.getByTestId('tray-create'));
    expect(
      await screen.findByText('Which site are you on?'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tower B' }));
    const sheet = await screen.findByTestId('capture-sheet');
    await user.click(within(sheet).getByTestId('capture-photo-only'));
    await waitFor(async () => expect(await listItems()).toHaveLength(1));
    expect((await listItems())[0]).toMatchObject({
      kind: 'create',
      siteId: SITE_B,
      note: null,
    });
  });

  it('delete asks first; cancel keeps the photos, confirm removes only the picked ones', async () => {
    await addToTray(files(1, 2, 3), SITE_A);
    renderTray(SITE_A);
    const user = userEvent.setup();
    const [first, second] = await tiles();
    await user.click(first);
    await user.click(second);
    await user.click(screen.getByTestId('tray-delete'));
    expect(await screen.findByText('Delete 2 photos?')).toBeInTheDocument();
    expect(
      screen.getByText("They leave the phone for good. This can't be undone."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Delete 2 photos?')).toBeNull(),
    );
    expect(await listTray(SITE_A)).toHaveLength(3);

    await user.click(screen.getByTestId('tray-delete'));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await listTray(SITE_A)).toHaveLength(1));
    expect(byteOf((await listTray(SITE_A))[0].photo.bytes)).toBe(3);
    expect(await listItems()).toEqual([]);
    expect(await tiles()).toHaveLength(1);
  });

  it('the import tile adds gallery photos to this site’s tray, shown first', async () => {
    await addToTray(files(1), SITE_A, new Date(Date.now() - 60_000));
    renderTray(SITE_A);
    await tiles();
    const user = userEvent.setup();
    await act(() =>
      user.upload(screen.getByTestId('tray-gallery-input'), files(7, 8)),
    );
    await waitFor(async () => expect(await listTray(SITE_A)).toHaveLength(3));
    await waitFor(() =>
      expect(screen.getAllByTestId('tray-photo')).toHaveLength(3),
    );
    const shown = await listTray(SITE_A);
    const firstTileId = shown.find((p) => byteOf(p.photo.bytes) === 7)!.id;
    // The newest import leads the grid: picking the first tile picks photo 7.
    await user.click(screen.getAllByTestId('tray-photo')[0]);
    await user.click(screen.getByTestId('tray-create'));
    const sheet = await screen.findByTestId('capture-sheet');
    await user.click(within(sheet).getByTestId('capture-photo-only'));
    await waitFor(async () => expect(await listItems()).toHaveLength(1));
    expect(byteOf((await listItems())[0].photo.bytes)).toBe(7);
    expect((await listTray(SITE_A)).some((p) => p.id === firstTileId)).toBe(
      false,
    );
  });
  it('above 100 photos it warns, without blocking anything', async () => {
    await addToTray(
      files(...Array.from({ length: 101 }, (_, i) => i % 250)),
      SITE_A,
    );
    renderTray(SITE_A);
    expect(await screen.findByTestId('tray-many')).toHaveTextContent(
      '101 photos wait on the phone.',
    );
    await userEvent.setup().click((await tiles())[0]);
    expect(screen.getByTestId('tray-create')).toBeEnabled();
  });

  it('storage full during an import: the photos that fit are kept and it says how many were not', async () => {
    renderTray(SITE_A);
    await screen.findByText('No unsorted photos');
    const realAdd = IDBObjectStore.prototype.add;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['add']>
    ) {
      calls += 1;
      if (calls === 3)
        throw new DOMException(
          'The quota has been exceeded.',
          'QuotaExceededError',
        );
      return realAdd.apply(this, args);
    });
    const user = userEvent.setup();
    await act(() =>
      user.upload(screen.getByTestId('tray-gallery-input'), files(1, 2, 3, 4)),
    );
    expect(await screen.findByTestId('tray-notice')).toHaveTextContent(
      "The phone's storage is full: 2 photos weren't kept.",
    );
    expect(await tiles()).toHaveLength(2);
    vi.mocked(IDBObjectStore.prototype.add).mockRestore();
  });
});
