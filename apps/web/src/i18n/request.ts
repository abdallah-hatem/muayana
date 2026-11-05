import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './config';
import { loadMessages } from './messages';

/**
 * next-intl without locale routing: the language comes from the NEXT_LOCALE cookie (Arabic by
 * default). T2's settings page writes the cookie; the user's saved locale wins after sign-in.
 */
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Africa/Cairo',
  };
});
