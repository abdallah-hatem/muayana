import { describe, expect, it } from 'vitest';
import {
  CATEGORY_PALETTE,
  isOffPalette,
  nextFreeColor,
} from './category-palette';

const all = CATEGORY_PALETTE.map((c) => c.hex);

describe('nextFreeColor', () => {
  it('starts with the first palette colour when nothing is used', () => {
    expect(nextFreeColor([])).toBe(CATEGORY_PALETTE[0].hex);
  });

  it('skips used colours, whatever their case', () => {
    expect(nextFreeColor([all[0].toLowerCase(), all[1]])).toBe(all[2]);
  });

  it('after the 12 seeded colours, offers a palette colour nobody uses', () => {
    const next = nextFreeColor(all.slice(0, 12));
    expect(all.slice(0, 12)).not.toContain(next);
    expect(isOffPalette(next)).toBe(false);
  });

  it('once every swatch is taken, generates an unused off-palette colour each time', () => {
    const used: string[] = [...all];
    for (let i = 0; i < 30; i++) {
      const next = nextFreeColor(used);
      expect(next).toMatch(/^#[0-9A-F]{6}$/);
      expect(used).not.toContain(next);
      expect(isOffPalette(next)).toBe(true);
      used.push(next);
    }
  });

  it('keeps the palette free of duplicates', () => {
    expect(new Set(all).size).toBe(all.length);
  });
});
