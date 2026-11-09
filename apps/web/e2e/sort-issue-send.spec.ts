import { expect, test, type Page } from '@playwright/test';
import {
  assignedIssue,
  captureIssue,
  createFixture,
  getIssue,
  signIn,
} from './support/api';

/**
 * T11 against a real API: the sort inbox, the issue page's status actions and the WhatsApp send.
 * Each test makes its own site, category and worker, so the inbox shows only its issues.
 */

const LAST_SITE_KEY = 'muayana:lastSiteId';

async function chooseSite(page: Page, siteId: string) {
  await page.evaluate(([key, id]) => window.localStorage.setItem(key, id), [
    LAST_SITE_KEY,
    siteId,
  ] as const);
}

test('@smoke Web: inbox sort — a captured issue gets category, description and worker, and leaves the inbox assigned', async ({
  page,
}) => {
  await signIn(page);
  const f = await createFixture(page);
  const issue = await captureIssue(page, f.site.id);
  await chooseSite(page, f.site.id);

  await page.goto('/inbox');
  const form = page.getByRole('form', { name: `#${issue.number}` });
  await expect(form).toBeVisible({ timeout: 60_000 });

  // Without a description it stays, with the inline error.
  await form
    .getByRole('button', {
      name: new RegExp(`${f.category.nameAr}|${f.category.nameEn}`),
    })
    .click();
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('textarea[aria-invalid="true"]')).toBeVisible();

  await form.locator('textarea').fill('Smoke: crack next to the window');
  await form.getByRole('combobox').click();
  await page.getByRole('option', { name: new RegExp(f.worker.name) }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page.getByTestId('screen-inbox')).toBeVisible();
  await expect(form).toBeHidden();
  const saved = await getIssue(page, issue.id);
  expect(saved.status).toBe('assigned');
  expect(saved.worker?.id).toBe(f.worker.id);
});

test('@smoke Web: issue status — moves the rules refuse are disabled; estimate then in progress writes history', async ({
  page,
}) => {
  await signIn(page);
  const f = await createFixture(page);
  const issue = await assignedIssue(page, f);

  await page.goto(`/issues/${issue.id}`);
  await expect(page.getByTestId('screen-issue')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-status="assigned"]').first()).toBeVisible();

  // Estimate: pick a day → estimated.
  await page
    .locator('section[aria-labelledby="status-actions-title"] button')
    .first()
    .click();
  await page.getByRole('grid').getByRole('button').last().click();
  await expect(page.locator('[data-status="estimated"]').first()).toBeVisible();

  // In progress, then the history has both moves.
  await page
    .locator('section[aria-labelledby="status-actions-title"] li button')
    .nth(2)
    .click();
  await expect(
    page.locator('[data-status="in_progress"]').first(),
  ).toBeVisible();
  const detail = await getIssue(page, issue.id);
  expect(detail.history.map((h) => h.to)).toEqual(
    expect.arrayContaining(['estimated', 'in_progress']),
  );
});

test('@smoke Web: send on WhatsApp — wa.me fallback, then "Mark as sent?" yes → sent', async ({
  page,
}) => {
  // No Web Share here: the wa.me link is the path; window.open is recorded, not followed.
  await page.addInitScript(() => {
    const nav = navigator as { share?: unknown; canShare?: unknown };
    delete nav.share;
    delete nav.canShare;
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'canShare', { value: undefined });
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return null;
    };
  });
  await signIn(page);
  const f = await createFixture(page);
  const issue = await assignedIssue(page, f);

  await page.goto(`/issues/${issue.id}`);
  await expect(page.getByTestId('screen-issue')).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: /واتساب|WhatsApp/ }).click();

  const opened = await page.evaluate(
    () => (window as unknown as { __opened: string[] }).__opened,
  );
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/20\d+\?text=/);
  expect(decodeURIComponent(opened[0])).toContain(`#${issue.number}`);

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  // Yes is the last action in the sheet's footer.
  await sheet.locator('[data-slot="sheet-footer"] button').last().click();
  await expect(page.locator('[data-status="sent"]').first()).toBeVisible();
  expect((await getIssue(page, issue.id)).status).toBe('sent');
});

test('@smoke Web: send on WhatsApp — the photo goes as a file, caption without links (§5.5, spec F3)', async ({
  page,
}) => {
  // Web Share with files: record what is shared instead of opening a share sheet.
  await page.addInitScript(() => {
    const w = window as unknown as {
      __shared: { names: string[]; types: string[]; text: string }[];
      __opened: string[];
    };
    w.__shared = [];
    w.__opened = [];
    Object.defineProperty(navigator, 'canShare', {
      value: (data: ShareData) => Boolean(data.files?.length),
    });
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        w.__shared.push({
          names: (data.files ?? []).map((f) => f.name),
          types: (data.files ?? []).map((f) => f.type),
          text: data.text ?? '',
        });
      },
    });
    window.open = (url?: string | URL) => {
      w.__opened.push(String(url));
      return null;
    };
  });
  await signIn(page);
  const f = await createFixture(page);
  const issue = await assignedIssue(page, f);

  await page.goto(`/issues/${issue.id}`);
  await expect(page.getByTestId('screen-issue')).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: /واتساب|WhatsApp/ }).click();

  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const { shared, opened } = await page.evaluate(() => {
    const w = window as unknown as {
      __shared: { names: string[]; types: string[]; text: string }[];
      __opened: string[];
    };
    return { shared: w.__shared, opened: w.__opened };
  });
  expect(opened).toEqual([]);
  expect(shared).toHaveLength(1);
  expect(shared[0].names).toEqual([`#${issue.number}-1.jpg`]);
  expect(shared[0].types).toEqual(['image/jpeg']);
  expect(shared[0].text).toContain(`#${issue.number}`);
  expect(shared[0].text).not.toMatch(/https?:\/\/|\/uploads\//);

  await sheet.locator('[data-slot="sheet-footer"] button').last().click();
  await expect(page.locator('[data-status="sent"]').first()).toBeVisible();
  expect((await getIssue(page, issue.id)).status).toBe('sent');
});
