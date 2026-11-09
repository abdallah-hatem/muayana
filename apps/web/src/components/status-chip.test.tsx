import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import common from '../../messages/ar/common.json';
import { StatusChip } from './status-chip';

describe('StatusChip', () => {
  it('in Arabic, the `sent` status reads «أُرسل للمقاول» (§4)', () => {
    render(
      <NextIntlClientProvider
        locale="ar"
        messages={{ common }}
        timeZone="Africa/Cairo"
      >
        <StatusChip status="sent" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('أُرسل للمقاول')).toBeInTheDocument();
  });
});
