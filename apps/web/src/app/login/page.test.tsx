/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn() }));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect.mockImplementation((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));
vi.mock('@/components/auth-form', () => ({
  AuthForm: ({ callbackUrl }: { callbackUrl: string }) =>
    createElement('span', { 'data-testid': 'callback' }, callbackUrl),
}));
vi.mock('@/server/auth/session', () => ({ getSession: mocks.getSession }));

import LoginPage from './page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('login callback handling', () => {
  it('falls back safely instead of crashing on repeated callback parameters', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(
      await LoginPage({
        searchParams: Promise.resolve({
          callbackUrl: ['/dashboard', '/terminal/a'],
        }),
      }),
    );

    expect(screen.getByTestId('callback').textContent).toBe('/dashboard');
    expect(
      screen
        .getByRole('link', { name: /create a trading profile/i })
        .getAttribute('href'),
    ).toBe('/register?callbackUrl=%2Fdashboard');
  });

  it('resumes a safe destination for an already authenticated trader', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'trader-1' } });

    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: '/terminal/account-1' }),
      }),
    ).rejects.toThrow('redirect:/terminal/account-1');
  });

  it('confirms that a verified email may sign in', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(
      await LoginPage({
        searchParams: Promise.resolve({ notice: 'email-verified' }),
      }),
    );

    expect(
      screen.getByText('Email confirmed. You can now sign in.'),
    ).toBeTruthy();
  });
});
