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
] as const;

export type PaletteKey = (typeof CATEGORY_PALETTE)[number]['key'];

/** The palette's first colour no category uses yet (else the first). */
export function nextFreeColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  return (
    CATEGORY_PALETTE.find((c) => !taken.has(c.hex)) ?? CATEGORY_PALETTE[0]
  ).hex;
}
