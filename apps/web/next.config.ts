import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev badge sits over the phone bottom bar in screenshots.
  devIndicators: false,
  // Lets a phone on the same Wi-Fi open the dev server by LAN IP (DEV_ORIGINS=192.168.1.2).
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').filter(Boolean),
  experimental: {
    // A stale on-disk Turbopack cache has produced broken production builds; build clean.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default withNextIntl(nextConfig);
