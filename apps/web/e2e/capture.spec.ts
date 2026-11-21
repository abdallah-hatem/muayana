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

test('@smoke Unsorted tray (N6): 5 gallery photos wait in the tray; 3 picked make one issue, then 1, then 1 is left', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page, '/capture');
  const siteName = `Tray ${Date.now()}`;
  const res = await page.request.post('/api/proxy/sites', {
    data: { name: siteName },
  });
  expect(res.ok()).toBeTruthy();
  await page.reload();
  const switcher = page.locator(
    '[data-slot="site-switcher"] [role="combobox"]',
  );
  await switcher.click();
  await page.getByRole('option', { name: siteName }).click();
  await expect(switcher).toContainText(siteName);

  // Five photos from the gallery: no issue yet, they wait in this site's tray, which opens.
  let creates = 0;
  page.on('response', (r) => {
    if (isCreate(r) && r.status() === 201) creates++;
  });
  const files = [];
  for (let i = 0; i < 5; i++)
    files.push(await cameraShot(page, `tray-${i}.jpg`));
  await page.getByTestId('gallery-input').setInputFiles(files);
  await expect(page).toHaveURL(/\/capture\/tray$/);
  const tiles = page.getByTestId('tray-photo');
  await expect(tiles).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByTestId('shutter-tray-badge')).toHaveText('5');
  expect(creates).toBe(0);

  // Pick three, numbered in pick order, and make one issue of them.
  await tiles.nth(1).click();
  await tiles.nth(0).click();
  await tiles.nth(4).click();
  await expect(page.getByTestId('tray-pick-badge')).toHaveText(['2', '1', '3']);
  await page.getByTestId('tray-create').click();
  const sheet = page.getByTestId('capture-sheet');
  await expect(sheet).toBeVisible();
  await expect(
    page.getByTestId('capture-sheet-photos').locator('img'),
  ).toHaveCount(3);
  await sheet.locator('#capture-location').fill('Roof');
  const created = page.waitForResponse(isCreate);
  await sheet.getByTestId('capture-save').click();
  const first = (
    (await (await created).json()) as { data: { id: string } }
  ).data;
  await expect(sheet).toBeHidden();
  await expect(tiles).toHaveCount(2);
  await expect(page.getByTestId('shutter-tray-badge')).toHaveText('2');

  // The issue has all three photos once the queue drains.
  await expect(page.getByTestId('queue-chip')).toHaveCount(0, {
    timeout: 30_000,
  });
  const issue = await page.request.get(`/api/proxy/issues/${first.id}`);
  const body = (await issue.json()) as {
    data: { location: string; photos: unknown[]; site: { name: string } };
  };
  expect(body.data.location).toBe('Roof');
  expect(body.data.photos).toHaveLength(3);

  // One more, alone: photo only. One photo is left in the tray.
  await tiles.nth(0).click();
  await page.getByTestId('tray-create').click();
  await expect(sheet).toBeVisible();
  await sheet.getByTestId('capture-photo-only').click();
  await expect(sheet).toBeHidden();
  await expect(tiles).toHaveCount(1);
  await expect.poll(() => creates, { timeout: 30_000 }).toBe(2);
  await expect(page.getByTestId('shutter-tray-badge')).toHaveText('1');

  // The tray is kept on the phone: a reload still shows the last photo.
  await page.reload();
  await expect(page.getByTestId('tray-photo')).toHaveCount(1);
});
