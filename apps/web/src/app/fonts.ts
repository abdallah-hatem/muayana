import { IBM_Plex_Mono, Readex_Pro } from 'next/font/google';

/** One family for Arabic and Latin (docs/DESIGN.md → Type): heavy, legible, even texture. */
export const readex = Readex_Pro({
  subsets: ['arabic', 'latin'],
  // Readex Pro tops out at 700 on Google Fonts; DESIGN.md's 800 renders as 700.
  weight: ['400', '500', '700'],
  variable: '--font-readex',
  display: 'swap',
});

/** Stencil numbers: issue numbers, dates, phones (Latin tabular digits). */
export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
});
