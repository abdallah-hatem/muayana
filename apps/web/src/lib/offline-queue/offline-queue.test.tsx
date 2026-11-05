import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import capture from '../../../messages/en/capture.json';
import { takeShot } from '@/app/(app)/capture/capture-shot';
import {
  QueueChip,
  QueueSheetProvider,
} from '@/components/offline-queue/queue-sheet';
import {
  MAX_ATTEMPTS,
  closeQueueDb,
  discardItem,
  enqueue,
  listItems,
  retryItem,
  startQueueSync,
  syncQueue,
} from './index';

// Compression has its own test (compress-photo.test.ts); here a photo passes straight through.
vi.mock('@/lib/compress-photo', () => ({
  compressPhoto: async (file: Blob) => ({ blob: file, width: 0, height: 0 }),
  PhotoUnreadableError: class extends Error {},
}));

const SITE = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
const photo = () =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], {
    type: 'image/jpeg',
  });

let online = true;
const fetchMock = vi.fn<typeof fetch>();
let clock = Date.UTC(2026, 10, 5, 9, 0, 0);
let stopSync: (() => void) | null = null;

const ok = (status = 201) =>
  Response.json({ success: true, data: { id: 'x' } }, { status });
const refused = (status: number, error: string) =>
  Response.json({ success: false, error, message: error }, { status });

/** The requests the queue sent: path and the multipart fields that identify the upload. */
function sent() {
  return fetchMock.mock.calls.map(([url, init]) => {
    const body = init?.body as FormData;
    return {
      path: String(url).replace('/api/proxy', ''),
      id: body.get('id'),
      file: body.get('photo') instanceof Blob,
    };
  });
}

/** Lets the time pass beyond any backoff. */
const later = (ms = 10 * 60_000) => {
  clock += ms;
};

const shoot = (
  mode: 'new' | 'attach',
  previous: { issueId: string; siteId: string } | null = null,
) =>
  takeShot({
    file: photo(),
    siteId: SITE,
    mode,
    previous,
    location: 'Floor 3',
  });

beforeEach(async () => {
  await closeQueueDb();
  globalThis.indexedDB = new IDBFactory();
  online = true;
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  stopSync?.();
  stopSync = null;
  await syncQueue();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('offline queue (T10 edge cases)', () => {
  it('Capture offline → item stored, badge count +1, nothing sent', async () => {
    online = false;
    render(
      <NextIntlClientProvider locale="en" messages={{ capture }}>
        <QueueSheetProvider>
          <QueueChip />
        </QueueSheetProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId('queue-chip')).not.toBeInTheDocument();

    await act(() => shoot('new'));

    expect(await screen.findByTestId('queue-chip')).toHaveTextContent(
      '1 waiting to upload',
    );
    const items = await listItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'create',
      siteId: SITE,
      status: 'pending',
      attempts: 0,
      location: 'Floor 3',
    });
    expect(items[0].photo.bytes.byteLength).toBe(6);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Reconnect → queue uploads in order; success removes item', async () => {
    online = false;
    const first = await shoot('new');
    const second = await shoot('attach', first.lastIssue);
    const third = await shoot('new');
    fetchMock.mockImplementation(async () => ok());
    stopSync = startQueueSync();
    expect(fetchMock).not.toHaveBeenCalled();

    online = true;
    window.dispatchEvent(new Event('online'));

    await waitFor(async () => expect(await listItems()).toEqual([]));
    expect(sent()).toEqual([
      { path: '/issues', id: first.item.id, file: true },
      { path: `/issues/${first.item.id}/photos`, id: null, file: true },
      { path: '/issues', id: third.item.id, file: true },
    ]);
    expect(second.item.issueId).toBe(first.item.id);
  });

  it('Upload succeeded but response lost → retry gets 200, item removed, no duplicate', async () => {
    const { item } = await enqueueCreate();
    // The server stored it, but the answer never reached the phone.
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await syncQueue();
    expect(await listItems()).toMatchObject([
      {
        id: item.id,
        status: 'pending',
        attempts: 1,
        lastError: 'NETWORK_ERROR',
      },
    ]);

    // The API answers 200 with the issue it already has for this id.
    fetchMock.mockResolvedValueOnce(ok(200));
    later();
    await syncQueue();

    expect(await listItems()).toEqual([]);
    expect(sent().map((r) => r.id)).toEqual([item.id, item.id]);
  });

  it('5 failures → marked failed, kept', async () => {
    const { item } = await enqueueCreate();
    fetchMock.mockImplementation(async () => refused(500, 'INTERNAL_ERROR'));

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await syncQueue();
      later();
    }

    expect(await listItems()).toMatchObject([
      {
        id: item.id,
        status: 'failed',
        attempts: 5,
        lastError: 'INTERNAL_ERROR',
      },
    ]);
    await syncQueue();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('Discard removes item and its blobs', async () => {
    online = false;
    const first = await shoot('new');
    await shoot('attach', first.lastIssue);
    const other = await shoot('new');

    await discardItem(first.item.id);

    // The new issue and the photo queued to join it are both gone; the other issue stays.
    expect((await listItems()).map((i) => i.id)).toEqual([other.item.id]);
  });

  it('App reload with items queued → still there and resume', async () => {
    online = false;
    const { item } = await shoot('new');

    await closeQueueDb(); // the app is closed and opened again
    expect(await listItems()).toMatchObject([
      { id: item.id, status: 'pending' },
    ]);

    online = true;
    fetchMock.mockImplementation(async () => ok());
    stopSync = startQueueSync(); // app open
    await waitFor(async () => expect(await listItems()).toEqual([]));
    expect(sent()).toEqual([{ path: '/issues', id: item.id, file: true }]);
  });

  it('Archived-site 409 → item marked failed with reason, not retried forever', async () => {
    const { item } = await enqueueCreate();
    const next = await enqueueCreate();
    fetchMock
      .mockResolvedValueOnce(refused(409, 'ARCHIVED_SITE'))
      .mockResolvedValueOnce(ok());

    await syncQueue();
    later();
    await syncQueue();

    expect(await listItems()).toMatchObject([
      { id: item.id, status: 'failed', lastError: 'ARCHIVED_SITE' },
    ]);
    // Refused once, never sent again; the item behind it was not held up.
    expect(sent().map((r) => r.id)).toEqual([item.id, next.item.id]);
  });

  it('"Add to previous issue" attaches the photo to the last issue, creates none', async () => {
    online = false;
    const first = await shoot('new');
    const added = await shoot('attach', first.lastIssue);

    expect(added.item).toMatchObject({
      kind: 'addPhoto',
      issueId: first.item.id,
    });
    expect(added.lastIssue.issueId).toBe(first.item.id);

    online = true;
    fetchMock.mockImplementation(async () => ok());
    await syncQueue();

    const paths = sent().map((r) => r.path);
    expect(paths.filter((p) => p === '/issues')).toHaveLength(1);
    expect(paths).toContain(`/issues/${first.item.id}/photos`);
    const attach = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(attach.get('kind')).toBe('before');
  });

  it('Manual retry of a failed item resets its attempts and uploads; discard of a failed item removes it', async () => {
    const retried = await enqueueCreate();
    const discarded = await enqueueCreate();
    fetchMock.mockImplementation(async () => refused(404, 'NOT_FOUND'));
    await syncQueue();
    expect((await listItems()).map((i) => i.status)).toEqual([
      'failed',
      'failed',
    ]);

    fetchMock.mockImplementation(async () => ok());
    await retryItem(retried.item.id);
    expect((await listItems()).map((i) => i.id)).toEqual([discarded.item.id]);
    expect(sent().at(-1)?.id).toBe(retried.item.id);

    await discardItem(discarded.item.id);
    expect(await listItems()).toEqual([]);
    expect(sent().filter((r) => r.id === discarded.item.id)).toHaveLength(1);
  });
});

function enqueueCreate() {
  return enqueue({
    kind: 'create',
    siteId: SITE,
    capturedAt: new Date(clock).toISOString(),
    photo: photo(),
  }).then((item) => ({ item }));
}
