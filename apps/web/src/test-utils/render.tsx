import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import common from '../../messages/en/common.json';
import inbox from '../../messages/en/inbox.json';
import issue from '../../messages/en/issue.json';
import send from '../../messages/en/send.json';
import shell from '../../messages/en/shell.json';

const messages = { common, inbox, issue, send, shell };

/** Renders under next-intl with the English messages the T11 screens use. */
export function renderWithIntl(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="Africa/Cairo"
      >
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
