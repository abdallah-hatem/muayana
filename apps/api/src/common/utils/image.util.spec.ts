import sharp from 'sharp';
import { sniffImageType, toStoredImage } from './image.util';

const image = (format: 'jpeg' | 'png' | 'webp', width = 30, height = 20) =>
  sharp({ create: { width, height, channels: 3, background: '#888' } })
    .toFormat(format)
    .toBuffer();

describe('sniffImageType', () => {
  it('recognises jpeg, png and webp by their bytes', async () => {
    expect(sniffImageType(await image('jpeg'))).toBe('image/jpeg');
    expect(sniffImageType(await image('png'))).toBe('image/png');
    expect(sniffImageType(await image('webp'))).toBe('image/webp');
  });

  it('refuses anything else', () => {
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('toStoredImage', () => {
  it('keeps a small image its size, as JPEG', async () => {
    const out = await toStoredImage(await image('png', 30, 20));
    expect(out).toMatchObject({ width: 30, height: 20 });
    expect(sniffImageType(out.body)).toBe('image/jpeg');
  });

  it('shrinks the long side to 1600', async () => {
    const out = await toStoredImage(await image('jpeg', 4000, 3000));
    expect([out.width, out.height]).toEqual([1600, 1200]);
  });

  it('throws on bytes that only look like an image', async () => {
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(64),
    ]);
    await expect(toStoredImage(fake)).rejects.toThrow();
  });
});
