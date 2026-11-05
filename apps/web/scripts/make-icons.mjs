// Draws the PWA icons into public/icons: the bold mark — a safety-yellow square with an ink "م".
// Run from apps/web: `node scripts/make-icons.mjs` (needs Playwright's Chromium installed).
// Colours: --primary and --primary-foreground from globals.css, as hex (see src/app/manifest.ts).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const YELLOW = '#fad117';
const INK = '#10141b';
const OUT = resolve(import.meta.dirname, '..', 'public', 'icons');

/** `inset` shrinks the glyph for maskable icons, whose outer 10% may be cropped to a circle. */
const ICONS = [
  { file: 'icon-192.png', size: 192, inset: 1 },
  { file: 'icon-512.png', size: 512, inset: 1 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, inset: 1 },
];

/** Draws the glyph on a canvas, centred on its real ink box and thickened with a stroke. */
const page = (size, inset) => `<!doctype html><html><body style="margin:0">
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
  const size = ${size}, box = size * 0.62 * ${inset};
  const ctx = document.getElementById('c').getContext('2d');
  ctx.fillStyle = '${YELLOW}';
  ctx.fillRect(0, 0, size, size);
  ctx.font = '700 ' + size + 'px "Segoe UI", "Noto Sans Arabic", Arial, sans-serif';
  ctx.direction = 'rtl';
  const m = ctx.measureText('م');
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const scale = box / Math.max(w, h);
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
                (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.fillStyle = ctx.strokeStyle = '${INK}';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.035 / scale;
  ctx.fillText('م', 0, 0);
  ctx.strokeText('م', 0, 0);
</script></body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const { file, size, inset } of ICONS) {
  const tab = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await tab.setContent(page(size, inset));
  await tab.screenshot({ path: resolve(OUT, file) });
  await tab.close();
}
await browser.close();
console.log(`icons written to ${OUT}`);
