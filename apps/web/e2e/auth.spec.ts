import { expect, test, type Page } from '@playwright/test';

/**
 * Sign-in and the app shell against a real API. The engineer's credentials come from the
 * environment (apps/web/.env.test: E2E_ENGINEER_EMAIL / E2E_ENGINEER_PASSWORD, the seeded
 * account) — never written here.
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

async function signIn(page: Page) {
  const { email, password } = credentials();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type="submit"]').click();
}

const nav = (page: Page) => page.getByRole('navigation');

test('@smoke Web: unauthenticated visit to /issues → redirect to /login, then sign in and walk the nav', async ({
  page,
}) => {
  await page.goto('/issues');
  await expect(page).toHaveURL(/\/login\?next=%2Fissues$/);

  await signIn(page);
  // The first signed-in page compiles the app shell in `next dev`: give it time.
  await expect(page).toHaveURL(/\/issues$/, { timeout: 60_000 });
  await expect(page.getByTestId('screen-issues')).toBeVisible();

  const stops = [
    ['/', 'screen-dashboard'],
    ['/capture', 'screen-capture'],
    ['/inbox', 'screen-inbox'],
    ['/workers', 'screen-workers'],
    ['/issues', 'screen-issues'],
  ] as const;
  for (const [href, testId] of stops) {
    await nav(page).locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(
      new RegExp(`${href === '/' ? '/$' : `${href}$`}`),
    );
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(nav(page).locator(`a[href="${href}"]`)).toHaveAttribute(
      'aria-current',
      'page',
    );
  }

  // Signed in, the login page sends you home.
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);

  // Settings → sign out → back to login, and the app is closed again.
  await page.locator('header a[href="/settings"]').click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.locator('#profile-name').waitFor();
  await page.getByRole('button', { name: /تسجيل الخروج|Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/workers');
  await expect(page).toHaveURL(/\/login\?next=%2Fworkers$/);
});
