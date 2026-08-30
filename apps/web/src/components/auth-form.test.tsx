/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.stubGlobal('fetch', mocks.fetch);

import { AuthForm } from './auth-form';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'trader@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: 'correct password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));
}

function submitRegistration() {
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: 'Trader' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'trader@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: 'a secure password' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Create trading profile' }),
  );
}

describe('auth form navigation', () => {
  it('navigates only after NextAuth reports a successful credential session', async () => {
    mocks.signIn.mockResolvedValue({
      error: null,
      ok: true,
      status: 200,
      url: 'http://localhost:3000/dashboard',
    });
    render(<AuthForm callbackUrl="/terminal/account-1" mode="login" />);

    submitLogin();

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/terminal/account-1');
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when the client receives an incomplete or failed sign-in response', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    render(<AuthForm callbackUrl="/terminal/account-1" mode="login" />);

    submitLogin();

    expect(
      await screen.findByText('Email or password was not recognized.'),
    ).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('offers a confirmation resend path when registration email delivery fails', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 503 });
    render(<AuthForm callbackUrl="/dashboard" mode="register" />);

    submitRegistration();

    expect(
      await screen.findByText(
        'Your profile may have been created, but we could not send its confirmation email.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'send a new confirmation link' })
        .getAttribute('href'),
    ).toBe('/verify-email');
  });
});
