import { expect, type Page } from '@playwright/test';
import type {
  Category,
  Issue,
  IssueDetail,
  Site,
  Worker,
} from '@muayana/shared';

/**
 * Sign-in and test data for the T11 smoke specs, through the app's own API proxy (the session
 * cookie rides along). Credentials come from the environment (apps/web/.env.test), never from here.
 */

export async function signIn(page: Page, next = '/'): Promise<void> {
  const email = process.env.E2E_ENGINEER_EMAIL;
  const password = process.env.E2E_ENGINEER_PASSWORD;
  if (!email || !password)
    throw new Error(
      'Set E2E_ENGINEER_EMAIL and E2E_ENGINEER_PASSWORD (see apps/web/.env.test.example)',
    );
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
}

export async function api<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<T> {
  const res = await page.request.fetch(`/api/proxy${path}`, { method, data });
  expect(res.ok(), `${method} ${path} → ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: T }).data;
}

/** A small real JPEG, drawn by the browser (the API reads its size). */
async function jpeg(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'gray';
        ctx.fillRect(0, 0, 64, 48);
        canvas.toBlob(
          (blob) =>
            void blob!
              .arrayBuffer()
              .then((b) => resolve(Array.from(new Uint8Array(b)))),
          'image/jpeg',
        );
      }),
  );
  return Buffer.from(bytes);
}

export interface Fixture {
  site: Site;
  category: Category;
  worker: Worker;
}

/** A fresh site, category and worker of that category, named uniquely for this run. */
export async function createFixture(page: Page): Promise<Fixture> {
  const tag = `${Date.now()}`.slice(-7);
  const site = await api<Site>(page, 'POST', '/sites', {
    name: `Smoke site ${tag}`,
  });
  const category = await api<Category>(page, 'POST', '/categories', {
    nameAr: `صنعة ${tag}`,
    nameEn: `Trade ${tag}`,
    color: '#3B6FD8',
  });
  const worker = await api<Worker>(page, 'POST', '/workers', {
    name: `Worker ${tag}`,
    phone: `010${tag.padStart(8, '0')}`,
    categoryIds: [category.id],
  });
  return { site, category, worker };
}

/** A captured (`new`) issue on the site, with one photo. */
export async function captureIssue(page: Page, siteId: string): Promise<Issue> {
  const res = await page.request.post('/api/proxy/issues', {
    multipart: {
      id: crypto.randomUUID(),
      siteId,
      capturedAt: new Date().toISOString(),
      photo: {
        name: 'defect.jpg',
        mimeType: 'image/jpeg',
        buffer: await jpeg(page),
      },
    },
  });
  expect(res.ok(), `POST /issues → ${res.status()}`).toBe(true);
  return ((await res.json()) as { data: Issue }).data;
}

/** An issue sorted and assigned to the fixture's worker. */
export async function assignedIssue(page: Page, f: Fixture): Promise<Issue> {
  const issue = await captureIssue(page, f.site.id);
  return api<Issue>(page, 'PATCH', `/issues/${issue.id}`, {
    categoryId: f.category.id,
    description: 'Smoke: crack next to the window',
    workerId: f.worker.id,
  });
}

export const getIssue = (page: Page, id: string) =>
  api<IssueDetail>(page, 'GET', `/issues/${id}`);
