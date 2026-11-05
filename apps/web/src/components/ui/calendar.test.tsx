import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { Calendar } from './calendar';

const NOV_2026 = new Date(2026, 10, 5);

function renderCalendar(locale: 'ar' | 'en') {
  const { container } = render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <Calendar mode="single" defaultMonth={NOV_2026} />
    </NextIntlClientProvider>,
  );
  return container.querySelector<HTMLElement>('[data-slot="calendar"]')!;
}

const firstWeekday = (root: HTMLElement) =>
  root.querySelector('thead th')?.getAttribute('aria-label');

describe('Calendar locale', () => {
  it('Arabic: Arabic month name, right-to-left, weeks start on Saturday', () => {
    const root = renderCalendar('ar');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(root).toHaveTextContent('نوفمبر');
    expect(root).not.toHaveTextContent('November');
    expect(firstWeekday(root)).toBe('السبت');
  });

  it('English: English month name, left-to-right, weeks start on Sunday', () => {
    const root = renderCalendar('en');
    expect(root).toHaveAttribute('dir', 'ltr');
    expect(root).toHaveTextContent('November 2026');
    expect(firstWeekday(root)).toBe('Sunday');
  });

  it('Arabic: the previous-month arrow points right (towards the start of the line)', () => {
    renderCalendar('ar');
    const previous = screen.getByRole('button', { name: /الشهر السابق/ });
    // lucide's chevron-right path
    expect(previous.querySelector('path')).toHaveAttribute(
      'd',
      'm9 18 6-6-6-6',
    );
  });
});
