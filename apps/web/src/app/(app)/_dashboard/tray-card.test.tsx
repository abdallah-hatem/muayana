import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeQueueDb } from '@/lib/offline-queue';
import { addToTray, resetTraySnapshot } from '@/lib/photo-tray';
import { renderIntl } from '@/test-utils/render-intl';
import { TrayCard } from './tray-card';

vi.mock('@/lib/compress-photo', () => ({
  compressPhoto: async (file: Blob) => ({ blob: file, width: 0, height: 0 }),
  PhotoUnreadableError: class extends Error {},
}));

const SITE_A = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
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

describe('dashboard tray card (N6)', () => {
  it('shows how many photos wait, with the way into the tray', async () => {
    await addToTray(photos(4), SITE_A);
    renderIntl(<TrayCard siteId={SITE_A} />);
    expect(await screen.findByTestId('tray-card-count')).toHaveTextContent('4');
    expect(screen.getByTestId('tray-card-open')).toHaveAttribute(
      'href',
      '/capture/tray',
    );
  });

  it('is not shown for a site whose tray is empty', async () => {
    await addToTray(photos(2), SITE_A);
    const other = '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e';
    renderIntl(<TrayCard siteId={other} />);
    // Give IndexedDB its turn, then check nothing rendered.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('tray-card')).toBeNull();
  });
});
