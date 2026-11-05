import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import auth from '../../../../messages/en/auth.json';
import { LoginForm } from './login-form';

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ auth }}>
      <LoginForm next="/issues" />
    </NextIntlClientProvider>,
  );
}

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText(/Email/), email);
  if (password) await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('LoginForm', () => {
  const fetchMock = vi.fn<typeof fetch>();
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('validation blocks submit and shows each field message', async () => {
    vi.stubGlobal('fetch', fetchMock);
    renderForm();
    await fill('not-an-email', '');
    expect(screen.getByText(/Enter a valid email/)).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 429 shows the minutes left, translated', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          success: false,
          error: 'TOO_MANY_REQUESTS',
          message: 'x',
          data: { retryAfterSeconds: 610 },
        },
        { status: 429 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderForm();
    await fill('eng@muayana.test', 'whatever');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Try again in 11 minutes',
    );
  });

  it('wrong credentials show one message, and a pending submit sends once', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);
    renderForm();
    const user = await fill('eng@muayana.test', 'wrong-pass');
    const button = screen.getByRole('button', { name: /Signing in/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(
      Response.json(
        { success: false, error: 'INVALID_CREDENTIALS', message: 'x' },
        { status: 401 },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Wrong email or password.',
      ),
    );
  });
});
