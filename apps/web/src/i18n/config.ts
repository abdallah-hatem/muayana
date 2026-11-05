import { DEFAULT_LOCALE, LOCALES, type Locale } from '@muayana/shared';

export { DEFAULT_LOCALE, LOCALES, type Locale };

/** Cookie holding the chosen language (no locale in the URL: one engineer, one language). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Message namespaces: one JSON file per namespace per locale, `messages/<locale>/<ns>.json`, so
 * UI tasks add their own file instead of editing a shared one. Add a namespace here when its
 * files land.
 */
export const NAMESPACES = ['common'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}
