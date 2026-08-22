import { describe, expect, it } from 'vitest';

import { parseRuntimeEnv } from './env';

describe('parseRuntimeEnv', () => {
  it('parses valid service configuration', () => {
    const parsed = parseRuntimeEnv({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      MOCK_PAYMENT_SIGNING_SECRET:
        'test-mock-payment-secret-with-thirty-two-characters',
      NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NEXTAUTH_URL: 'http://localhost:3000',
      VALKEY_URL: 'redis://localhost:6379',
    });

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.BUSINESS_TIMEZONE).toBe('UTC');
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: 'mysql://localhost/app',
        MOCK_PAYMENT_SIGNING_SECRET:
          'test-mock-payment-secret-with-thirty-two-characters',
        NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
        NEXTAUTH_URL: 'http://localhost:3000',
        VALKEY_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });
});
