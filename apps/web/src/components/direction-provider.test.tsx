import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DirectionProvider } from './direction-provider';

function renderSelect(locale: 'ar' | 'en') {
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <DirectionProvider>
        <Select defaultValue="a">
          <SelectTrigger aria-label="site">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </DirectionProvider>
    </NextIntlClientProvider>,
  );
}

describe('DirectionProvider', () => {
  it('Arabic: Radix controls lay out right-to-left', () => {
    renderSelect('ar');
    expect(screen.getByRole('combobox', { name: 'site' })).toHaveAttribute(
      'dir',
      'rtl',
    );
  });

  it('English: Radix controls lay out left-to-right', () => {
    renderSelect('en');
    expect(screen.getByRole('combobox', { name: 'site' })).toHaveAttribute(
      'dir',
      'ltr',
    );
  });
});
