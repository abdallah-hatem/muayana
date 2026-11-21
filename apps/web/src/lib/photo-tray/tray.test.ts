import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeQueueDb, enqueue, listItems } from '@/lib/offline-queue';
import {
  TrayPhotoMissingError,
  addToTray,
  isQuotaError,
  listTray,
  removeFromTray,
  trayToIssue,
} from './index';

// Compression has its own test; here a photo passes straight through, so its bytes identify it.
// An empty file is one the phone can't read.
const unreadable = vi.hoisted(() => ({
  Error: class PhotoUnreadableError extends Error {},
}));
vi.mock('@/lib/compress-photo', () => ({
  compressPhoto: async (file: Blob) => {
    if (file.size === 0) throw new unreadable.Error();
    return { blob: file, width: 0, height: 0 };
  },
  PhotoUnreadableError: unreadable.Error,
}));

const SITE_A = '7a1c3f0e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
const SITE_B = '9b2f1c3e-2d4a-4b5c-8d6e-7f8a9b0c1d2e';
const NOW = new Date('2026-11-21T10:42:00.000Z');

/** A gallery file whose one byte is `n`, dated `lastModified`. */
const file = (n: number, lastModified = NOW.getTime() - 60_000) =>
  new File([new Uint8Array([n])], `p${n}.jpg`, {
    type: 'image/jpeg',
    lastModified,
  });
const files = (...ns: number[]) => ns.map((n) => file(n));
const byteOf = (bytes: ArrayBuffer) => new Uint8Array(bytes)[0];

const quota = () =>
  new DOMException('The quota has been exceeded.', 'QuotaExceededError');

beforeEach(async () => {
  await closeQueueDb();
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tray store (N6)', () => {
  it('imports photos into a site tray, in the order picked, dated by the file', async () => {
    const taken = new Date('2026-11-20T08:00:00.000Z');
    const result = await addToTray(
      [file(1, taken.getTime()), file(2), file(3)],
      SITE_A,
      NOW,
    );
    expect(result).toEqual({ added: 3, unreadable: 0, notStored: 0, total: 3 });
    const photos = await listTray(SITE_A);
    expect(photos.map((p) => byteOf(p.photo.bytes))).toEqual([1, 2, 3]);
    expect(photos[0]).toMatchObject({
      siteId: SITE_A,
      importedAt: NOW.getTime(),
      capturedAt: taken.toISOString(),
    });
  });

  it('a file dated in the future is dated at the import', async () => {
    await addToTray([file(1, NOW.getTime() + 60_000)], SITE_A, NOW);
    expect((await listTray(SITE_A))[0].capturedAt).toBe(NOW.toISOString());
  });

  it('lists per site; "All sites" (null) lists every photo, its own imports included', async () => {
    await addToTray(files(1, 2), SITE_A, NOW);
    await addToTray(files(3), SITE_B, NOW);
    await addToTray(files(4), null, NOW);
    expect((await listTray(SITE_A)).map((p) => byteOf(p.photo.bytes))).toEqual([
      1, 2,
    ]);
    expect((await listTray(SITE_B)).map((p) => byteOf(p.photo.bytes))).toEqual([
      3,
    ]);
    expect(await listTray(null)).toHaveLength(4);
  });

  it('removes photos from the tray', async () => {
    await addToTray(files(1, 2, 3), SITE_A, NOW);
    const [first, , third] = await listTray(SITE_A);
    await removeFromTray([first.id, third.id]);
    expect((await listTray(SITE_A)).map((p) => byteOf(p.photo.bytes))).toEqual([
      2,
    ]);
  });

  it('survives an app reload (a new connection reads the same photos)', async () => {
    await addToTray(files(1, 2), SITE_A, NOW);
    await closeQueueDb();
    expect(await listTray(SITE_A)).toHaveLength(2);
  });

  it('upgrading the phone database keeps the upload queue already waiting', async () => {
    const v1 = await openDB('muayana-capture', 1, {
      upgrade(db) {
        db.createObjectStore('queue', { keyPath: 'id' }).createIndex(
          'bySeq',
          'seq',
        );
      },
    });
    await v1.put('queue', {
      id: 'old',
      kind: 'create',
      issueId: 'old',
      siteId: SITE_A,
      seq: 1,
      status: 'pending',
    });
    v1.close();
    expect((await listItems()).map((i) => i.id)).toEqual(['old']);
    expect(await listTray(null)).toEqual([]);
  });

  it('storage full: the photos before it are kept, the rest are counted as not stored', async () => {
    const realAdd = IDBObjectStore.prototype.add;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['add']>
    ) {
      calls += 1;
      if (calls === 3) throw quota();
      return realAdd.apply(this, args);
    });
    const result = await addToTray(files(1, 2, 3, 4, 5), SITE_A, NOW);
    expect(result).toEqual({ added: 2, unreadable: 0, notStored: 3, total: 2 });
    expect(await listTray(SITE_A)).toHaveLength(2);
  });

  it('a photo the phone cannot read is left out; the others are kept', async () => {
    const empty = new File([], 'broken.jpg', { type: 'image/jpeg' });
    const result = await addToTray([file(1), empty, file(2)], SITE_A, NOW);
    expect(result).toMatchObject({ added: 2, unreadable: 1, notStored: 0 });
  });

  it('isQuotaError knows the browsers’ names for a full disk', () => {
    expect(isQuotaError(quota())).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError(new Error('nope'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('making an issue from tray photos (N6)', () => {
  const ISSUE = '3f0b8c1e-5a2d-4e6f-9a7b-1c2d3e4f5a6b';

  async function pickFrom(...positions: number[]) {
    await addToTray(files(1, 2, 3, 4, 5), SITE_A, NOW);
    const photos = await listTray(SITE_A);
    return positions.map((i) => photos[i].id);
  }

  it('enqueues a create and an addPhoto per other photo, in pick order, with the phone-made id', async () => {
    const picks = await pickFrom(2, 0, 3);
    const outcome = await trayToIssue({
      issueId: ISSUE,
      siteId: SITE_A,
      photoIds: picks,
      details: { note: 'Cracked tile', location: 'Lobby', priority: 'high' },
    });
    expect(outcome).toBe('created');
    const items = await listItems();
    expect(
      items.map((i) => [i.kind, i.issueId, byteOf(i.photo.bytes), i.status]),
    ).toEqual([
      ['create', ISSUE, 3, 'pending'],
      ['addPhoto', ISSUE, 1, 'pending'],
      ['addPhoto', ISSUE, 4, 'pending'],
    ]);
    expect(items[0]).toMatchObject({
      id: ISSUE,
      siteId: SITE_A,
      note: 'Cracked tile',
      location: 'Lobby',
      priority: 'high',
    });
    // The picked photos left the tray; the other two stay.
    expect((await listTray(SITE_A)).map((p) => byteOf(p.photo.bytes))).toEqual([
      2, 5,
    ]);
  });

  it('goes after what is already queued, never before it', async () => {
    await enqueue({
      kind: 'create',
      siteId: SITE_A,
      capturedAt: NOW.toISOString(),
      photo: new Blob([new Uint8Array([9])]),
    });
    const picks = await pickFrom(0, 1);
    await trayToIssue({
      issueId: ISSUE,
      siteId: SITE_A,
      photoIds: picks,
      details: {},
    });
    const items = await listItems();
    expect(items.map((i) => byteOf(i.photo.bytes))).toEqual([9, 1, 2]);
    expect(items.map((i) => i.seq)).toEqual([1, 2, 3]);
  });

  it('a retry with the same issue id adds no duplicate', async () => {
    const picks = await pickFrom(0, 1);
    const input = {
      issueId: ISSUE,
      siteId: SITE_A,
      photoIds: picks,
      details: {},
    };
    await trayToIssue(input);
    expect(await trayToIssue(input)).toBe('already');
    expect(await listItems()).toHaveLength(2);
    expect(await listTray(SITE_A)).toHaveLength(3);
  });

  it('photos leave the tray only once the uploads are stored: a failed write keeps them all', async () => {
    const picks = await pickFrom(0, 1, 2);
    const realAdd = IDBObjectStore.prototype.add;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['add']>
    ) {
      calls += 1;
      if (calls === 2) throw quota();
      return realAdd.apply(this, args);
    });
    const failed = await trayToIssue({
      issueId: ISSUE,
      siteId: SITE_A,
      photoIds: picks,
      details: {},
    }).catch((error: unknown) => error);
    expect(isQuotaError(failed)).toBe(true);
    expect(await listItems()).toEqual([]);
    expect(await listTray(SITE_A)).toHaveLength(5);

    // The same sheet saved again, once there is room: one issue, no leftovers.
    vi.restoreAllMocks();
    await trayToIssue({
      issueId: ISSUE,
      siteId: SITE_A,
      photoIds: picks,
      details: {},
    });
    expect((await listItems()).map((i) => i.kind)).toEqual([
      'create',
      'addPhoto',
      'addPhoto',
    ]);
    expect(await listTray(SITE_A)).toHaveLength(2);
  });

  it('a photo no longer in the tray refuses the whole issue and changes nothing', async () => {
    const picks = await pickFrom(0, 1);
    await removeFromTray([picks[1]]);
    await expect(
      trayToIssue({
        issueId: ISSUE,
        siteId: SITE_A,
        photoIds: picks,
        details: {},
      }),
    ).rejects.toBeInstanceOf(TrayPhotoMissingError);
    expect(await listItems()).toEqual([]);
    expect(await listTray(SITE_A)).toHaveLength(4);
  });

  it('tray photos can go to another site than the one they were imported under', async () => {
    await addToTray(files(1), null, NOW);
    const [photo] = await listTray(null);
    await trayToIssue({
      issueId: ISSUE,
      siteId: SITE_B,
      photoIds: [photo.id],
      details: {},
    });
    expect((await listItems())[0]).toMatchObject({
      kind: 'create',
      siteId: SITE_B,
    });
  });
});
