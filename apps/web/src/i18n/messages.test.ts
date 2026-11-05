import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
