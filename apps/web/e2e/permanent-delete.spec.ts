import { expect, test } from '@playwright/test';
import type { Issue, Worker } from '@muayana/shared';
import {
  api,
  assignedIssue,
  createFixture,
  getIssue,
  signIn,
} from './support/api';

/**
 * D1 + D2 against a real API: delete an issue from its page, and delete a contractor — keeping his
 * issues, or deleting them too (red, asked twice). Labels are matched in both languages.
 */

const exists = async (
  page: Parameters<typeof api>[0],
  path: string,
): Promise<boolean> =>
  (await page.request.get(`/api/proxy${path}`)).status() !== 404;

test('@smoke Web: delete an issue — any status, confirm names it, cancel keeps it, back to the list', async ({
  page,
}) => {
  await signIn(page);
  const f = await createFixture(page);
  const issue = await assignedIssue(page, f);
  await api<Issue>(page, 'POST', `/issues/${issue.id}/status`, {
    status: 'solved',
  });

  await page.goto(`/issues/${issue.id}`);
  const open = page.getByRole('button', {
    name: /^(Delete issue|حذف الملاحظة)$/,
  });
  await expect(open).toBeVisible({ timeout: 60_000 });

  // Cancel: nothing deleted.
  await open.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText(`#${issue.number}`);
  await sheet.getByRole('button', { name: /^(Cancel|إلغاء)$/ }).click();
  await expect(sheet).toBeHidden();
  expect(await exists(page, `/issues/${issue.id}`)).toBe(true);

  await open.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Delete permanently|حذف نهائي)$/ })
    .click();
  await expect(page).toHaveURL(/\/issues$/, { timeout: 30_000 });
  expect(await exists(page, `/issues/${issue.id}`)).toBe(false);
});

test('@smoke Web: delete a contractor with issues — keep them (unassigned) or delete them too after a second confirm', async ({
  page,
}) => {
  await signIn(page);

  // Keep: his issue goes back to unassigned.
  const keep = await createFixture(page);
  const kept = await assignedIssue(page, keep);
  await page.goto(`/workers/${keep.worker.id}`);
  const del = page.getByRole('button', { name: /^(Delete|حذف)$/ });
  await expect(del).toBeEnabled({ timeout: 60_000 });
  await del.click();
  const choose = page.getByTestId('delete-worker-choose');
  await expect(choose).toBeVisible();
  await choose
    .getByRole('button', { name: /Keep the issues|الاحتفاظ بالملاحظات/ })
    .click();
  await expect(page).toHaveURL(/\/workers$/, { timeout: 30_000 });
  expect(await exists(page, `/workers/${keep.worker.id}`)).toBe(false);
  expect(await getIssue(page, kept.id)).toMatchObject({
    status: 'unassigned',
    worker: null,
  });

  // Delete too: the red choice asks again; Back sends nothing.
  const gone = await createFixture(page);
  const doomed = await assignedIssue(page, gone);
  await page.goto(`/workers/${gone.worker.id}`);
  await expect(del).toBeEnabled({ timeout: 60_000 });
  await del.click();
  await page
    .getByTestId('delete-worker-choose')
    .getByRole('button', { name: /Delete his|حذف ملاحظاته/ })
    .click();
  const destroy = page.getByTestId('delete-worker-destroy');
  await expect(destroy).toBeVisible();
  await destroy.getByRole('button', { name: /^(Back|رجوع)$/ }).click();
  await expect(page.getByTestId('delete-worker-choose')).toBeVisible();
  expect(await exists(page, `/workers/${gone.worker.id}`)).toBe(true);

  await page
    .getByTestId('delete-worker-choose')
    .getByRole('button', { name: /Delete his|حذف ملاحظاته/ })
    .click();
  await page
    .getByTestId('delete-worker-destroy')
    .getByRole('button', { name: /^(Delete permanently|حذف نهائي)$/ })
    .click();
  await expect(page).toHaveURL(/\/workers$/, { timeout: 30_000 });
  expect(await exists(page, `/workers/${gone.worker.id}`)).toBe(false);
  expect(await exists(page, `/issues/${doomed.id}`)).toBe(false);
  // The contractors list no longer has him.
  const list = await api<Worker[]>(
    page,
    'GET',
    `/workers?active=all&search=${encodeURIComponent(gone.worker.name)}`,
  );
  expect(list.some((w) => w.id === gone.worker.id)).toBe(false);
});
