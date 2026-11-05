import { expect, test, type Page } from '@playwright/test';

/**
 * Capture against a real API (T10): pick a site, shoot through the camera input, see it upload;
 * shoot offline, see it wait in the queue, reconnect and see it go. Credentials come from the
 * environment (apps/web/.env.test), never written here.
 */
function credentials(): { email: string; password: string } {
  const email = process.env.E2E_ENGINEER_EMAIL;
  const password = process.env.E2E_ENGINEER_PASSWORD;
  if (!email || !password)
    throw new Error(
      'Set E2E_ENGINEER_EMAIL and E2E_ENGINEER_PASSWORD (see apps/web/.env.test.example)',
    );
  return { email, password };
}

async function signIn(page: Page, next: string) {
  const { email, password } = credentials();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`${next}$`), { timeout: 60_000 });
}

/** A real JPEG drawn by the browser, as the phone camera would hand one over. */
async function cameraShot(page: Page, name: string) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'gray';
    ctx.fillRect(0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.8);
  });
  return {
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  };
}

test('@smoke Capture: a photo uploads as a new issue; offline it waits in the queue and goes up on reconnect', async ({
  page,
  context,
}) => {
  await signIn(page, '/capture');

  // A site of its own, so the test never depends on seed data.
  const siteName = `Smoke ${Date.now()}`;
  const created = await page.request.post('/api/proxy/sites', {
    data: { name: siteName },
  });
  expect(created.ok()).toBeTruthy();
  await page.reload();

  await page.getByTestId('site-chip').click();
  await page.getByRole('button', { name: siteName }).click();
  await expect(page.getByTestId('site-chip')).toContainText(siteName);

  // Online: the shot is stored, then uploaded as POST /issues.
  const upload = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/proxy/issues') && r.request().method() === 'POST',
  );
  await page
    .getByTestId('camera-input')
    .setInputFiles(await cameraShot(page, 'first.jpg'));
  expect((await upload).status()).toBe(201);
  await expect(page.getByTestId('queue-chip')).toHaveCount(0);

  // Offline: kept on the phone, badge shows it, nothing sent.
  const second = await cameraShot(page, 'second.jpg');
  await context.setOffline(true);
  await page.getByTestId('camera-input').setInputFiles(second);
  await expect(page.getByTestId('queue-chip')).toContainText('1');

  // Back online: the queue drains by itself.
  const resumed = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/proxy/issues') && r.request().method() === 'POST',
  );
  await context.setOffline(false);
  expect((await resumed).status()).toBe(201);
  await expect(page.getByTestId('queue-chip')).toHaveCount(0);
});
