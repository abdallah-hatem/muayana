import type { AbstractIntlMessages } from 'next-intl';
import { NAMESPACES, type Locale } from './config';

/**
 * Loads every namespace file of a locale and merges them under their namespace:
 * `messages/ar/common.json` → `{ common: {...} }`, read with `useTranslations('common')`.
 */
export async function loadMessages(
  locale: Locale,
): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const file = (await import(
        `../../messages/${locale}/${namespace}.json`
      )) as { default: AbstractIntlMessages };
      return [namespace, file.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
