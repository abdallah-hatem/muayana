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

const isCreate = (r: { url(): string; request(): { method(): string } }) =>
  r.url().endsWith('/api/proxy/issues') && r.request().method() === 'POST';

test('@smoke Capture: photos then one sheet (place, description, trade, contractor) upload as an assigned issue; offline a photo-only capture waits and goes up on reconnect', async ({
  page,
  context,
}) => {
  // Sign-in waits up to 60s for a cold `next dev` to compile /capture: the test needs more than 30s.
  test.setTimeout(120_000);
  await signIn(page, '/capture');

  // A site, trade and contractor of its own, so the test never depends on seed data.
  const stamp = Date.now();
  const siteName = `Smoke ${stamp}`;
  const tradeName = `Smoke trade ${stamp}`;
  const contractorName = `Smoke contractor ${stamp}`;
  const post = async (path: string, data: object) => {
    const res = await page.request.post(`/api/proxy${path}`, { data });
    expect(res.ok(), `POST ${path} → ${res.status()}`).toBeTruthy();
    return ((await res.json()) as { data: { id: string } }).data;
  };
  await post('/sites', { name: siteName });
  const trade = await post('/categories', {
    nameAr: tradeName,
    nameEn: tradeName,
    color: '#123456',
  });
  await post('/workers', {
    name: contractorName,
    phone: `010${String(stamp).slice(-8)}`,
    categoryIds: [trade.id],
  });
  await page.reload();

  // The site is the top bar's switcher — the capture page has no second picker.
  const switcher = page.locator(
    '[data-slot="site-switcher"] [role="combobox"]',
  );
  await switcher.click();
  await page.getByRole('option', { name: siteName }).click();
  await expect(switcher).toContainText(siteName);

  // The photo opens the sheet with the keyboard down: nothing is uploaded yet.
  await page
    .getByTestId('camera-input')
    .setInputFiles(await cameraShot(page, 'first.jpg'));
  const sheet = page.getByTestId('capture-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toBeFocused();
  await expect(
    page.getByTestId('capture-sheet-photos').locator('img'),
  ).toHaveCount(1);

  // Another photo for this same issue, before saving.
  await sheet.getByTestId('capture-add-photo').click();
  await page
    .getByTestId('camera-input')
    .setInputFiles(await cameraShot(page, 'second.jpg'));
  await expect(
    page.getByTestId('capture-sheet-photos').locator('img'),
  ).toHaveCount(2);

  await sheet.locator('#capture-location').fill('Lobby');
  await sheet.locator('#capture-description').fill('Crack over the door');
  await sheet.getByRole('button', { name: tradeName }).click();
  await sheet.locator('#capture-worker').click();
  await page.getByRole('option', { name: new RegExp(contractorName) }).click();

  const created = page.waitForResponse(isCreate);
  const photoAdded = page.waitForResponse((r) =>
    /\/api\/proxy\/issues\/[^/]+\/photos$/.test(r.url()),
  );
  await sheet.getByTestId('capture-save').click();
  const res = await created;
  expect(res.status()).toBe(201);
  const issue = (
    (await res.json()) as {
      data: {
        id: string;
        status: string;
        location: string;
        worker: { name: string } | null;
      };
    }
  ).data;
  expect(issue).toMatchObject({
    status: 'assigned',
    location: 'Lobby',
    worker: { name: contractorName },
  });
  expect((await photoAdded).status()).toBe(201);
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('queue-chip')).toHaveCount(0);

  // Offline: the sheet still works from the lists the phone saw; "photo only" waits in the queue.
  await context.setOffline(true);
  await page
    .getByTestId('camera-input')
    .setInputFiles(await cameraShot(page, 'third.jpg'));
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: tradeName })).toBeVisible();
  await expect(sheet.getByTestId('capture-lookups-stale')).toBeVisible();
  await sheet.getByTestId('capture-photo-only').click();
  await expect(page.getByTestId('queue-chip')).toContainText('1');

  // Back online: the queue drains by itself.
  const resumed = page.waitForResponse(isCreate);
  await context.setOffline(false);
  const back = await resumed;
  expect(back.status()).toBe(201);
  expect(
    ((await back.json()) as { data: { status: string } }).data.status,
  ).toBe('new');
  await expect(page.getByTestId('queue-chip')).toHaveCount(0);
});
