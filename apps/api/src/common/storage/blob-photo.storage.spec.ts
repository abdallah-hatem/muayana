import { del, put } from '@vercel/blob';
import { BlobPhotoStorage } from './blob-photo.storage';

jest.mock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn() }));

const putMock = put as jest.MockedFunction<typeof put>;
const delMock = del as jest.MockedFunction<typeof del>;

describe('BlobPhotoStorage', () => {
  const storage = new BlobPhotoStorage('blob-token');

  beforeEach(() => jest.clearAllMocks());

  it('uploads a public JPEG with a random suffix (business §6.10) and returns its pathname and url', async () => {
    putMock.mockResolvedValue({
      pathname: 'issues/a/b-Xy12.jpg',
      url: 'https://store.public.blob.vercel-storage.com/issues/a/b-Xy12.jpg',
    } as Awaited<ReturnType<typeof put>>);
    const body = Buffer.from('jpeg');

    const stored = await storage.put('issues/a/b.jpg', body, 'image/jpeg');

    expect(putMock).toHaveBeenCalledWith('issues/a/b.jpg', body, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/jpeg',
      token: 'blob-token',
    });
    expect(stored).toEqual({
      key: 'issues/a/b-Xy12.jpg',
      url: 'https://store.public.blob.vercel-storage.com/issues/a/b-Xy12.jpg',
    });
  });

  it('deletes by the stored key with the store token', async () => {
    delMock.mockResolvedValue(undefined);
    await storage.delete('issues/a/b-Xy12.jpg');
    expect(delMock).toHaveBeenCalledWith('issues/a/b-Xy12.jpg', {
      token: 'blob-token',
    });
  });
});
