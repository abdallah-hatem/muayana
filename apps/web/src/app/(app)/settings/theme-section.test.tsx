import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test-utils/render';
import { ThemeSection } from './settings-sections';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('ThemeSection', () => {
  it('on a phone the theme is chosen in Settings: the stored one is checked, a tap applies another', async () => {
    renderWithIntl(<ThemeSection />);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();

    await userEvent
      .setup()
      .click(screen.getByRole('radio', { name: 'System' }));
    expect(setTheme).toHaveBeenCalledWith('system');
  });
});
