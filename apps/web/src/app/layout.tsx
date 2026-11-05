import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { directionOf } from '@muayana/shared';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { isLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { plexMono, readex } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: t('app.name'),
    description: t('app.tagline'),
    applicationName: 'Muayana',
    appleWebApp: {
      capable: true,
      title: t('app.name'),
      statusBarStyle: 'default',
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Content may draw under the notch and home indicator; the shell pads with safe-area insets.
  // Pinch-zoom stays on: no maximum-scale or user-scalable=no.
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : 'ar';

  return (
    // next-themes writes the theme class before paint; the server can't know it.
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={cn(readex.variable, plexMono.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <NextIntlClientProvider>
            {children}
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
