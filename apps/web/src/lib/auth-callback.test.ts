import { describe, expect, it } from 'vitest';

import { authPageHref, safeCallbackUrl } from './auth-callback';

describe('safeCallbackUrl', () => {
  it('preserves one internal protected-route callback', () => {
    expect(safeCallbackUrl('/terminal/account-1?tab=orders')).toBe(
      '/terminal/account-1?tab=orders',
    );
  });

  it.each([
    undefined,
    ['/', '/terminal/account-1'],
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
  ])('falls back safely for an unsafe callback %#', (value) => {
    expect(safeCallbackUrl(value)).toBe('/dashboard');
  });

  it('preserves the safe route while linking between auth pages', () => {
    expect(authPageHref('/register', '/terminal/account-1')).toBe(
      '/register?callbackUrl=%2Fterminal%2Faccount-1',
    );
  });
});
