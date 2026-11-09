import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import capture from '../../messages/en/capture.json';
import common from '../../messages/en/common.json';
import inbox from '../../messages/en/inbox.json';
import issue from '../../messages/en/issue.json';
import send from '../../messages/en/send.json';
import settings from '../../messages/en/settings.json';
import shell from '../../messages/en/shell.json';
import sites from '../../messages/en/sites.json';
import categories from '../../messages/en/categories.json';
import workers from '../../messages/en/workers.json';

const messages = {
  capture,
  common,
  inbox,
  issue,
  send,
  settings,
  shell,
  sites,
  categories,
  workers,
};

/** Renders under next-intl with the English messages. */
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
