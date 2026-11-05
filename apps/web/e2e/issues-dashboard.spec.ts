import { expect, test, type Page } from '@playwright/test';

/**
 * T12 against a real API (seeded): the issues list filter goes into the URL and is exactly what
 * the CSV export sends; dashboard numbers open the list filtered to them. The UI is Arabic by
 * default, so these specs find things by test id and URL, not by text.
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

async function signInAt(page: Page, path: string) {
  await page.goto(path);
  const { email, password } = credentials();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== '/login', {
    timeout: 60_000,
  });
}

/** Picks a status in whichever filter editor this viewport shows (sheet on phone, panel on desktop). */
async function pickStatus(page: Page, status: string) {
  const panel = page.getByTestId('filter-panel');
  if (await panel.isVisible()) {
    await panel.locator(`button[data-value="${status}"]`).click();
    return;
  }
  await page.getByTestId('open-filters').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator(`button[data-value="${status}"]`).click();
  await sheet.getByTestId('apply-filters').click();
}

test('@smoke Web: issues list filter survives reload and is exactly what the CSV export sends', async ({
  page,
}) => {
  await signInAt(page, '/issues');
  await expect(page.getByTestId('screen-issues')).toBeVisible();

  await pickStatus(page, 'sent');
  await expect(page).toHaveURL(/\/issues\?status=sent$/);
  await expect(page.getByTestId('filter-chip')).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId('filter-chip')).toHaveCount(1);
  await expect(page.getByTestId('issues-count')).not.toBeEmpty();

  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-count')).toBeVisible();
  const [request, download] = await Promise.all([
    page.waitForRequest((r) =>
      r.url().includes('/api/proxy/issues/export.csv'),
    ),
    page.waitForEvent('download'),
    page.getByTestId('export-download').click(),
  ]);
  const sent = new URL(request.url()).searchParams;
  expect(sent.get('status')).toBe('sent');
  expect(sent.get('lang')).toBe('ar');
  expect(sent.get('columns')?.split(',').length).toBe(19);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test('@smoke Web: a dashboard number opens the issues list filtered to it', async ({
  page,
}) => {
  await signInAt(page, '/');
  await expect(page.getByTestId('screen-dashboard')).toBeVisible();

  await page.getByTestId('stat-overdue').click();
  await expect(page).toHaveURL(/\/issues\?overdue=true$/);
  await expect(page.getByTestId('filter-chip')).toHaveCount(1);

  await page.goto('/');
  await page.getByTestId('stat-open').click();
  await expect(page).toHaveURL(
    /\/issues\?status=unassigned%2Cassigned%2Csent%2Cestimated%2Cin_progress$/,
  );
  await expect(page.getByTestId('filter-chip')).toHaveCount(5);

  await page.goto('/');
  await page.getByTestId('inbox-start').click();
  await expect(page).toHaveURL(/\/inbox$/);
});
