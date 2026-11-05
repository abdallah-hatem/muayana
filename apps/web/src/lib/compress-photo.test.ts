import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressPhoto, fitWithin } from './compress-photo';

/** jsdom has no image decoding or canvas: stand in for both and record what was asked. */
function stubImagePipeline(width: number, height: number) {
  const close = vi.fn();
  const decode = vi.fn(async () => ({ width, height, close }));
  vi.stubGlobal('createImageBitmap', decode);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function (this: HTMLCanvasElement, done, type) {
      done(new Blob([`${this.width}x${this.height}`], { type }));
    });
  return { decode, drawImage, toBlob, close };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compressPhoto', () => {
  it('Compression: 4000×3000 → long side 1600, JPEG', async () => {
    const pipe = stubImagePipeline(4000, 3000);
    const camera = new Blob(['raw'], { type: 'image/heic' });

    const out = await compressPhoto(camera);

    expect(out).toMatchObject({ width: 1600, height: 1200 });
    expect(out.blob.type).toBe('image/jpeg');
    expect(await out.blob.text()).toBe('1600x1200');
    // Decoded with the camera's EXIF orientation applied, so the JPEG comes out upright.
    expect(pipe.decode).toHaveBeenCalledWith(camera, {
      imageOrientation: 'from-image',
    });
    expect(pipe.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1600,
      1200,
    );
    expect(pipe.toBlob.mock.calls[0][1]).toBe('image/jpeg');
    expect(pipe.close).toHaveBeenCalled();
  });

  it('a portrait photo keeps its long side at 1600 and a small one is never enlarged', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('an undecodable photo the API accepts goes up as it is; anything else is refused', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode');
      }),
    );
    const jpeg = new Blob(['x'], { type: 'image/jpeg' });
    expect((await compressPhoto(jpeg)).blob).toBe(jpeg);
    await expect(
      compressPhoto(new Blob(['x'], { type: 'image/heic' })),
    ).rejects.toThrow('PHOTO_UNREADABLE');
  });
});
