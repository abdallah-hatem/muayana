import 'fake-indexeddb/auto';
import { screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteProvider } from '@/components/site/site-context';
import { LAST_SITE_KEY } from '@/lib/last-site';
import { closeQueueDb } from '@/lib/offline-queue';
import {
  addToTray,
  removeFromTray,
  listTray,
  resetTraySnapshot,
} from '@/lib/photo-tray';
import { renderWithIntl } from '@/test-utils/render';
import { BottomNav } from './bottom-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/compress-photo', () => ({
  compressPhoto: async (file: Blob) => ({ blob: file, width: 0, height: 0 }),
  PhotoUnreadableError: class extends Error {},
}));

const SITE_A = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
const SITE_B = '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e';
const photos = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => new File([new Uint8Array([i])], `p${i}.jpg`),
  );

beforeEach(async () => {
  await closeQueueDb();
  globalThis.indexedDB = new IDBFactory();
  resetTraySnapshot();
});

function renderNav(siteId: string | null) {
  if (siteId) window.localStorage.setItem(LAST_SITE_KEY, siteId);
  return renderWithIntl(
    <SiteProvider>
      <BottomNav />
    </SiteProvider>,
  );
}

const shutter = () => screen.getByRole('link', { name: /^Capture/ });

describe('shutter tray badge (N6)', () => {
  it('counts the chosen site’s tray, and says it in the shutter’s label', async () => {
    await addToTray(photos(3), SITE_A);
    await addToTray(photos(2), SITE_B);
    renderNav(SITE_A);
    expect(await screen.findByTestId('shutter-tray-badge')).toHaveTextContent(
      '3',
    );
    expect(shutter()).toHaveAccessibleName('Capture · 3 unsorted photos');
  });

  it('"All sites" counts every site’s tray', async () => {
    await addToTray(photos(3), SITE_A);
    await addToTray(photos(2), SITE_B);
    renderNav(null);
    expect(await screen.findByTestId('shutter-tray-badge')).toHaveTextContent(
      '5',
    );
  });

  it('no badge while the tray is empty, and it goes when the last photo leaves', async () => {
    await addToTray(photos(1), SITE_A);
    renderNav(SITE_A);
    await screen.findByTestId('shutter-tray-badge');
    await removeFromTray((await listTray(SITE_A)).map((p) => p.id));
    await waitFor(() =>
      expect(screen.queryByTestId('shutter-tray-badge')).toBeNull(),
    );
    expect(shutter()).toHaveAccessibleName('Capture');
  });
});
