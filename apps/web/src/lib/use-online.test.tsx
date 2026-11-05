import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import capture from '../../messages/en/capture.json';
import { clientFetch } from './api-client';
import { useNeedsConnection } from './use-online';

let online = true;
const fetchMock = vi.fn<typeof fetch>();

/** An online-only action (sort / assign / export all go through the same guard). */
function ExportButton() {
  const t = useTranslations('capture');
  const [blocked, setBlocked] = useState(false);
  const onBlocked = useCallback(() => setBlocked(true), []);
  const { online: isOnline, guard } = useNeedsConnection(onBlocked);
  return (
    <>
      <button
        type="button"
        data-online={isOnline}
        onClick={guard(() =>
          clientFetch('/issues/export.csv', { method: 'GET' }),
        )}
      >
        export
      </button>
      {blocked && <p role="alert">{t('needsConnection')}</p>}
    </>
  );
}

beforeEach(() => {
  online = true;
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ success: true, data: {} }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('useNeedsConnection', () => {
  it('Offline: sort/assign/export actions show "needs connection" and send nothing', async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={{ capture }}>
        <ExportButton />
      </NextIntlClientProvider>,
    );
    const button = screen.getByRole('button', { name: 'export' });

    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(button).toHaveAttribute('data-online', 'false');
    await user.click(button);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Needs a connection. Only capture works offline.',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      online = true;
      window.dispatchEvent(new Event('online'));
    });
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
