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

import RegisterPage from './page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('registration callback handling', () => {
  it('preserves a safe protected-route callback through registration', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(
      await RegisterPage({
        searchParams: Promise.resolve({ callbackUrl: '/terminal/account-1' }),
      }),
    );

    expect(screen.getByTestId('callback').textContent).toBe(
      '/terminal/account-1',
    );
    expect(
      screen.getByRole('link', { name: 'Sign in' }).getAttribute('href'),
    ).toBe('/login?callbackUrl=%2Fterminal%2Faccount-1');
  });
});
