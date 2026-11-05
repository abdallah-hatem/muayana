import type { PhotoStorage } from '../src/common/storage/photo-storage.interface';
import {
  restoreMissingPlaceholders,
  storePlaceholders,
  type PlaceholderPhoto,
} from './seed-photos';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

/** A storage driver that answers like Blob: the key comes back with a random suffix. */
function mockStorage() {
  const put = jest.fn((key: string) =>
    Promise.resolve({
      key: key.replace(/\.jpg$/, '-Xy7.jpg'),
      url: `https://store.public.blob.vercel-storage.com/${key}`,
    }),
  );
  return {
    storage: { put, delete: jest.fn() } as unknown as PhotoStorage,
    put,
  };
}

const photo = (n: number): PlaceholderPhoto => ({
  key: `issues/issue-${n}/photo-${n}.jpg`,
  color: '#E8590C',
  label: `#${n}`,
});

describe('seed photo step', () => {
  jest.setTimeout(30_000);

  it('writes every placeholder through the storage driver as a JPEG', async () => {
    const { storage, put } = mockStorage();
    await storePlaceholders(storage, [photo(1), photo(2)]);

    expect(put).toHaveBeenCalledTimes(2);
    for (const [index, call] of put.mock.calls.entries()) {
      const [key, body, contentType] = call as unknown as [
        string,
        Buffer,
        string,
      ];
      expect(key).toBe(photo(index + 1).key);
      expect([...body.subarray(0, 3)]).toEqual(JPEG_MAGIC);
      expect(contentType).toBe('image/jpeg');
    }
  });

  it("returns the driver's own key and URL, not the requested key", async () => {
    const { storage } = mockStorage();
    const stored = await storePlaceholders(storage, [photo(1)]);
    expect(stored.get(photo(1).key)).toEqual({
      key: 'issues/issue-1/photo-1-Xy7.jpg',
      url: `https://store.public.blob.vercel-storage.com/${photo(1).key}`,
    });
  });

  it('re-running restores only the missing files (idempotent)', async () => {
    const { storage, put } = mockStorage();
    const present = new Set([photo(1).key, photo(3).key]);
    const restored = await restoreMissingPlaceholders(
      storage,
      [photo(1), photo(2), photo(3)],
      (key) => Promise.resolve(present.has(key)),
    );
    expect(restored).toBe(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(photo(2).key);

    put.mockClear();
    expect(
      await restoreMissingPlaceholders(storage, [photo(1)], () =>
        Promise.resolve(true),
      ),
    ).toBe(0);
    expect(put).not.toHaveBeenCalled();
  });
});
