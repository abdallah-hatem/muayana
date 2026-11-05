import { expect, test } from '@playwright/test';
import type { Category, Worker } from '@muayana/shared';
import { api, signIn } from './support/api';

/**
 * T9 against a real API: add a worker through the form, edit him, deactivate, and delete him
 * (he has no issues). Labels are matched in both languages (Arabic is the default).
 */

test('@smoke Web: workers CRUD — add, edit, deactivate and delete a worker', async ({
  page,
}) => {
  await signIn(page);
  const tag = `${Date.now()}`.slice(-7);
  const category = await api<Category>(page, 'POST', '/categories', {
    nameAr: `صنعة عمال ${tag}`,
    nameEn: `Workers trade ${tag}`,
    color: '#1971C2',
  });

  // Add: a local number with spaces, normalised to +20…
  await page.goto('/workers/new');
  const form = page.locator('form');
  await expect(form.getByLabel(/Name|الاسم/)).toBeVisible({ timeout: 60_000 });
  await form.getByLabel(/Name|الاسم/).fill(`Smoke worker ${tag}`);
  await form.getByLabel(/Phone|الهاتف/).fill(`011 ${tag.padStart(8, '0')}`);
  await form
    .getByRole('button', {
      name: new RegExp(`${category.nameAr}|${category.nameEn}`),
    })
    .click();
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/workers\/[0-9a-f-]{36}$/, {
    timeout: 30_000,
  });
  const id = page.url().split('/').pop()!;
  const created = await api<Worker>(page, 'GET', `/workers/${id}`);
  expect(created.phone).toBe(`+2011${tag.padStart(8, '0')}`);
  expect(created.categories.map((c) => c.id)).toEqual([category.id]);

  // Edit the name in the sheet.
  await page.getByRole('button', { name: /^(Edit|تعديل)$/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(/Name|الاسم/).fill(`Smoke worker ${tag} edited`);
  await sheet.locator('button[type="submit"]').click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole('heading', { name: `Smoke worker ${tag} edited` }).first(),
  ).toBeVisible();

  // Deactivate: the badge shows and the batch send is off.
  await page.getByRole('button', { name: /^(Deactivate|إيقاف)$/ }).click();
  await expect(page.getByText(/^(Deactivated|موقوف)$/).first()).toBeVisible();
  expect((await api<Worker>(page, 'GET', `/workers/${id}`)).active).toBe(false);

  // Delete: he has no issues.
  await page.getByRole('button', { name: /^(Delete|حذف)$/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Delete|حذف)$/ })
    .click();
  await expect(page).toHaveURL(/\/workers$/);
  const gone = await page.request.get(`/api/proxy/workers/${id}`);
  expect(gone.status()).toBe(404);
});
