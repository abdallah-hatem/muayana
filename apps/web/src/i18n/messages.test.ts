import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { LOCALES, NAMESPACES } from './config';
import { loadMessages } from './messages';

const MESSAGES_DIR = join(__dirname, '..', '..', 'messages');

/** Every leaf key path of a messages object: `status.new`, `app.name`… */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('loadMessages', () => {
  it.each(LOCALES)(
    'merges every namespace of %s under its name',
    async (locale) => {
      const messages = await loadMessages(locale);
      expect(Object.keys(messages).sort()).toEqual([...NAMESPACES].sort());
    },
  );
});

describe('locale files', () => {
  it('every namespace file on disk is registered in NAMESPACES', () => {
    for (const locale of LOCALES) {
      const files = readdirSync(join(MESSAGES_DIR, locale))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
      expect(files.sort()).toEqual([...NAMESPACES].sort());
    }
  });

  it.each(NAMESPACES)('ar and en have identical keys in %s', (namespace) => {
    const [ar, en] = (['ar', 'en'] as const).map(
      (locale) =>
        JSON.parse(
          readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), 'utf8'),
        ) as unknown,
    );
    expect(keyPaths(ar).sort()).toEqual(keyPaths(en).sort());
  });
});

describe('Arabic plurals (two and 11+ read correctly)', () => {
  type Translate = (
    key: string,
    values: Record<string, string | number>,
  ) => string;
  const ar = async (): Promise<Translate> =>
    createTranslator({
      locale: 'ar',
      messages: await loadMessages('ar'),
    }) as unknown as Translate;

  it.each([
    [2, 'إرسال ملاحظتين مُسندتين على واتساب'],
    [3, 'إرسال 3 ملاحظات مُسندة على واتساب'],
    [11, 'إرسال 11 ملاحظة مُسندة على واتساب'],
  ])('send.batch.button with %i', async (count, text) => {
    expect((await ar())('send.batch.button', { count })).toBe(text);
  });

  it.each([
    [2, 'اعتبار الملاحظتين مُرسلتين؟'],
    [11, 'اعتبار كل الـ 11 ملاحظة مُرسلة؟'],
  ])('send.batch.confirmBody with %i', async (count, text) => {
    expect((await ar())('send.batch.confirmBody', { count })).toBe(text);
  });

  it.each([
    [2, 'جزأين'],
    [11, '11 جزءاً'],
  ])('send.parts.hint with %i parts', async (parts, text) => {
    expect((await ar())('send.parts.hint', { parts })).toContain(
      `على ${text}.`,
    );
  });

  it.each([
    [2, 'من أصل ملاحظتين.'],
    [11, 'من أصل 11 ملاحظة.'],
  ])('excel.tooBig with %i issues, Latin digits', async (total, text) => {
    const message = (await ar())('excel.tooBig', {
      size: '16.2',
      fit: 1,
      total,
    });
    expect(message).toContain(text);
    expect(message).toContain('15 ميجابايت');
  });

  it.each([
    [2, 'لملاحظتين'],
    [11, 'لـ 11 ملاحظة'],
  ])('inbox.bulk.categoryDone with %i', async (count, text) => {
    expect((await ar())('inbox.bulk.categoryDone', { count })).toContain(text);
  });
});
