import { expect, test } from '@playwright/test';
import type { Category } from '@muayana/shared';
import { api, signIn } from './support/api';

/**
 * T8 against a real API: two new categories land last; moving the second one up swaps them, and
 * the saved order (PUT /categories/order) survives a reload.
 */

test('@smoke Web: categories reorder — moving a category up saves the new order', async ({
  page,
}) => {
  await signIn(page);
  const tag = `${Date.now()}`.slice(-7);
  const first = await api<Category>(page, 'POST', '/categories', {
    nameAr: `ترتيب أ ${tag}`,
    nameEn: `Order A ${tag}`,
    color: '#E8590C',
  });
  const second = await api<Category>(page, 'POST', '/categories', {
    nameAr: `ترتيب ب ${tag}`,
    nameEn: `Order B ${tag}`,
    color: '#0CA678',
  });

  await page.goto('/settings/categories');
  const rows = page.getByTestId('category-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const names = new RegExp(`(Order [AB]|ترتيب [أب]) ${tag}`);
  const ours = async () =>
    (await rows.filter({ hasText: names }).allTextContents()).map((text) =>
      text.includes(first.nameAr) || text.includes(first.nameEn!) ? 'A' : 'B',
    );
  expect(await ours()).toEqual(['A', 'B']);

  await rows
    .filter({ hasText: new RegExp(`${second.nameAr}|${second.nameEn}`) })
    .getByRole('button', { name: /Move .* up|تحريك .* لأعلى/ })
    .click();
  await expect.poll(ours).toEqual(['B', 'A']);

  await expect
    .poll(async () => {
      const all = await api<Category[]>(page, 'GET', '/categories?active=all');
      const order = [...all].sort((a, b) => a.sortOrder - b.sortOrder);
      return (
        order.findIndex((c) => c.id === second.id) <
        order.findIndex((c) => c.id === first.id)
      );
    })
    .toBe(true);

  await page.reload();
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  expect(await ours()).toEqual(['B', 'A']);
});
