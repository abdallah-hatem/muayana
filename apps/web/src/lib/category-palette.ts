/**
 * The colours a category can take (stored as `#RRGGBB`, contract): a fixed set — the seed's trade
 * colours — each strong enough to read as a dot on the light and the dark background. `key` names
 * it in `categories.colors.<key>`.
 */
export const CATEGORY_PALETTE = [
  { key: 'orange', hex: '#E8590C' },
  { key: 'yellow', hex: '#FAB005' },
  { key: 'blue', hex: '#1971C2' },
  { key: 'brown', hex: '#A27B5C' },
  { key: 'green', hex: '#5C940D' },
  { key: 'teal', hex: '#0CA678' },
  { key: 'cyan', hex: '#15AABF' },
  { key: 'grey', hex: '#868E96' },
  { key: 'graphite', hex: '#495057' },
  { key: 'purple', hex: '#AE3EC9' },
  { key: 'pink', hex: '#E64980' },
  { key: 'red', hex: '#C92A2A' },
  { key: 'indigo', hex: '#4C6EF5' },
  { key: 'violet', hex: '#7950F2' },
  { key: 'lime', hex: '#82C91E' },
  { key: 'forest', hex: '#2B8A3E' },
  { key: 'sky', hex: '#4DABF7' },
  { key: 'coral', hex: '#FF8787' },
  { key: 'sand', hex: '#D9A441' },
  { key: 'plum', hex: '#862E9C' },
  { key: 'mint', hex: '#38D9A9' },
  { key: 'olive', hex: '#94A133' },
  { key: 'rose', hex: '#F783AC' },
  { key: 'copper', hex: '#B35C1E' },
] as const;

export type PaletteKey = (typeof CATEGORY_PALETTE)[number]['key'];

const isPaletteColor = (hex: string) =>
  CATEGORY_PALETTE.some((c) => c.hex === hex.toUpperCase());

/** `true` when `hex` is not one of the palette swatches (a generated or older colour). */
export function isOffPalette(hex: string): boolean {
  return !isPaletteColor(hex);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * The colour a new category starts with: the palette's first colour no category uses yet. Once
 * every swatch is taken, a generated colour no category uses (hues spread by the golden angle, at
 * a strength that reads on the light and the dark background), so a new category never shares a
 * colour by default.
 */
export function nextFreeColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  const free = CATEGORY_PALETTE.find((c) => !taken.has(c.hex));
  if (free) return free.hex;
  for (let i = 0; i < 360; i++) {
    const hue = (i * 137.508) % 360;
    const light = i % 2 === 0 ? 0.48 : 0.4;
    const hex = hslToHex(hue, 0.7, light);
    if (!taken.has(hex)) return hex;
  }
  return CATEGORY_PALETTE[0].hex;
}
