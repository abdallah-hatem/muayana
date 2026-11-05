import { expect, test } from '@playwright/test';

test('@smoke /design renders the design system in Arabic RTL and switches to English LTR', async ({
  page,
}) => {
  await page.goto('/design');

  const root = page.getByTestId('design-root');
  await expect(root).toHaveAttribute('dir', 'rtl');
  // Every status is stamped with a label, never colour alone.
  await expect(
    page.getByTestId('status-chips').locator('[data-status]'),
  ).toHaveCount(8);

  await page.getByRole('button', { name: 'English' }).click();
  await expect(root).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Design system — Site tape',
  );

  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
