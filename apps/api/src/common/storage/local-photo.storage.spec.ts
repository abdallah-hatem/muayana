import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalPhotoStorage } from './local-photo.storage';

describe('LocalPhotoStorage', () => {
  let root: string;
  let storage: LocalPhotoStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'muayana-storage-'));
    storage = new LocalPhotoStorage(root, 'http://localhost:3101/uploads/');
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it('writes under the root and returns the public url', async () => {
    const stored = await storage.put(
      'issues/a/b.jpg',
      Buffer.from('x'),
      'image/jpeg',
    );
    expect(stored).toEqual({
      key: 'issues/a/b.jpg',
      url: 'http://localhost:3101/uploads/issues/a/b.jpg',
    });
    expect(await readFile(join(root, 'issues/a/b.jpg'), 'utf8')).toBe('x');
  });

  it('delete removes the file and ignores a missing one', async () => {
    await storage.put('issues/a/b.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.delete('issues/a/b.jpg');
    await expect(storage.delete('issues/a/b.jpg')).resolves.toBeUndefined();
  });

  it('refuses a key that escapes the root', async () => {
    await expect(
      storage.put('../outside.jpg', Buffer.from('x'), 'image/jpeg'),
    ).rejects.toThrow(/outside/);
  });
});
