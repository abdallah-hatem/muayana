import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import {
  api,
  assignedIssue,
  createFixture,
  getIssue,
  signIn,
} from './support/api';

/**
 * N4 against a real API: a contractor's `assigned` issues as an .xlsx built in the browser (no file
 * sharing on desktop Chromium → it downloads), opened with exceljs: one row per issue, Arabic
 * headers on a right-to-left sheet, the photos embedded as pictures, no URLs. Then "Mark as sent?"
 * yes moves exactly those issues to `sent`.
 */
test('@smoke Web: contractor page → Send as Excel → file with pictures, RTL → mark as sent', async ({
  page,
}) => {
  await signIn(page);
  const fixture = await createFixture(page);
  const issues = [
    await assignedIssue(page, fixture),
    await assignedIssue(page, fixture),
  ];
  // Arabic, the default language.
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'ar', url: page.url() }]);

  await page.goto(`/workers/${fixture.worker.id}`);
  await page.getByRole('button', { name: 'إرسال كملف Excel' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'تجهيز الملف' }).click();
  await expect(sheet.getByTestId('excel-ready')).toBeVisible({
    timeout: 60_000,
  });

  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'مشاركة الملف' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await readFile(await file.path())) as unknown as ArrayBuffer,
  );
  const ws = workbook.worksheets[0];
  expect(ws.views[0].rightToLeft).toBe(true);
  expect(ws.getRow(1).getCell(1).value).toBe('الرقم');
  expect(ws.actualRowCount).toBe(1 + issues.length);
  expect(ws.getImages()).toHaveLength(issues.length);
  const text: string[] = [];
  ws.eachRow((row) =>
    (row.values as unknown[]).forEach(
      (v) => typeof v === 'string' && text.push(v),
    ),
  );
  expect(text.join(' ')).not.toMatch(/https?:\/\//);

  // "Mark as sent?" → yes: both issues are now `sent`.
  await page.getByRole('button', { name: 'نعم، أُرسلت' }).click();
  await expect(page.getByRole('button', { name: 'نعم، أُرسلت' })).toBeHidden();
  for (const issue of issues)
    expect((await getIssue(page, issue.id)).status).toBe('sent');
  expect(
    (
      await api<{ counts: { sent: number } }>(
        page,
        'GET',
        `/workers/${fixture.worker.id}`,
      )
    ).counts.sent,
  ).toBe(issues.length);
});
