import type { MetadataRoute } from 'next';

/**
 * Colours are the tokens in globals.css converted to hex (a manifest can't read CSS variables):
 * `--primary` oklch(0.87 0.175 94) → #fad117, light `--background` oklch(0.962 0.009 85) →
 * #f5f2ec. Change them together with the tokens.
 */
export const PWA_THEME_COLOR = '#fad117';
export const PWA_BACKGROUND_LIGHT = '#f5f2ec';
/** Dark `--background` oklch(0.17 0.012 260). */
export const PWA_BACKGROUND_DARK = '#0c1015';

/** Installable PWA: the engineer adds it to the home screen and it opens straight to the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'معاينة',
    short_name: 'معاينة',
    description: 'Site snags, photographed, sorted and sent.',
    lang: 'ar',
    dir: 'rtl',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_LIGHT,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [{ name: 'Capture', url: '/capture' }],
  };
}
