import { expect, test, type Page } from '@playwright/test';
import sitesAr from '../messages/ar/sites.json';
import sitesEn from '../messages/en/sites.json';
import { signIn } from './support/api';

/**
 * Opening an overlay never moves the page (UI audit M3). Radix's scroll lock used to hide the page
 * scrollbar and pad <body> on the physical right, so in Arabic the fixed side nav jumped 10px on
 * every Select, Dialog and Sheet. Real scrollbars are needed to see it: headless Chromium hides
 * them by default.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

type Rect = [number, number, number, number];

/** The main column and every fixed element (top bar, side nav), as [x, y, width, height]. */
function measure(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const els = [
      document.querySelector('main'),
      ...Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
        (el) =>
          getComputedStyle(el).position === 'fixed' &&
          !el.closest('[data-radix-popper-content-wrapper], [role="dialog"]') &&
          !el.matches('[data-slot$="-overlay"]') &&
          el.getBoundingClientRect().width > 0,
      ),
    ].filter((el): el is HTMLElement => el !== null);
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height] as Rect;
    });
  });
}

/** The page scrollbar's width: 0 means the gutter was dropped and the page moved. */
const gutter = (page: Page) =>
  page.evaluate(
    () =>
      window.innerWidth -
      document.documentElement.getBoundingClientRect().width,
  );

async function expectStill(page: Page, open: () => Promise<void>) {
  const before = await measure(page);
  const gutterBefore = await gutter(page);
  await open();
  await page.waitForTimeout(300); // let the open animation settle
  expect(await measure(page)).toEqual(before);
  expect(await gutter(page)).toBe(gutterBefore);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

for (const locale of ['ar', 'en'] as const) {
  test(`@smoke Web (${locale}): opening a select, a dialog or a sheet doesn't move the page`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'the side nav and page scrollbar are desktop',
    );
    test.setTimeout(120_000);
    await signIn(page, '/issues');
    // Sign-in applies the engineer's saved language; switch it for this browser only.
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: locale, url: baseURL! },
    ]);
    await page.reload();
    await expect(page.getByTestId('screen-issues')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      locale === 'ar' ? 'rtl' : 'ltr',
    );
    // The list must overflow, or there is no scrollbar to lose.
    expect(await gutter(page)).toBeGreaterThan(0);

    const switcher = page.locator(
      '[data-slot="site-switcher"] [role="combobox"]',
    );
    await expect(switcher).toBeEnabled({ timeout: 30_000 });
    await expectStill(page, () => switcher.click());
    await expectStill(page, () => page.getByTestId('open-export').click());

    await page.goto('/settings/sites');
    await expect(page.getByTestId('screen-sites')).toBeVisible();
    const newSite = (locale === 'ar' ? sitesAr : sitesEn).new;
    await expectStill(page, () =>
      page.getByRole('button', { name: newSite }).first().click(),
    );
  });
}
