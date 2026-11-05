import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser specs on a phone (Pixel 7) and a desktop. `@smoke` in a test title marks the quick
 * set (`npm run test:smoke`).
 *
 * Nothing here hardcodes a port. From the environment (apps/web/.env.test fills in anything unset):
 * - BASE_URL: test a server that is already running (preview, or your own dev server).
 * - otherwise WEB_PORT: Playwright starts `next dev` on it. API_PORT, if set, points that dev
 *   server's API_URL at http://localhost:API_PORT/api/v1.
 * A parallel agent uses its port block (web 31N3, API 31N1): `npm run db:agent -- ports N`.
 */
const envFile = resolve(__dirname, '.env.test');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = process.env.WEB_PORT;
const baseURL =
  process.env.BASE_URL ?? (port ? `http://localhost:${port}` : undefined);

if (!baseURL) {
  throw new Error(
    'Set BASE_URL or WEB_PORT to run Playwright (see apps/web/.env.test.example)',
  );
}

const apiPort = process.env.API_PORT;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      // Pixel 7 is a Chromium preset; Chromium is the one browser installed.
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: apiPort
          ? { API_URL: `http://localhost:${apiPort}/api/v1` }
          : undefined,
      },
});
