import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import commonAr from '../../messages/ar/common.json';
import dashboardAr from '../../messages/ar/dashboard.json';
import exportAr from '../../messages/ar/export.json';
import issuesAr from '../../messages/ar/issues.json';
import common from '../../messages/en/common.json';
import dashboard from '../../messages/en/dashboard.json';
import exportMessages from '../../messages/en/export.json';
import issues from '../../messages/en/issues.json';

const MESSAGES = {
  en: { common, issues, export: exportMessages, dashboard },
  ar: {
    common: commonAr,
    issues: issuesAr,
    export: exportAr,
    dashboard: dashboardAr,
  },
};

/** Renders inside next-intl with the list / export / dashboard messages (English by default). */
export function renderIntl(ui: ReactElement, locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="Africa/Cairo"
    >
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>{ui}</div>
    </NextIntlClientProvider>,
  );
}
