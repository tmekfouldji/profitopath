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
    expect(parsed.AUTH_LOGIN_EMAIL_MAX_ATTEMPTS).toBe(5);
    expect(parsed.AUTH_LOGIN_IP_MAX_ATTEMPTS).toBe(25);
    expect(parsed.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS).toBe(900);
    expect(parsed.BUSINESS_TIMEZONE).toBe('UTC');
    expect(parsed.COMPETITION_JOBS_ENABLED).toBe(true);
    expect(parsed.COMPETITION_JOB_INTERVAL_MS).toBe(15_000);
    expect(parsed.AUTO_FINALIZE_FROZEN_COMPETITIONS).toBe(false);
    expect(parsed.MARKET_DATA_SOURCE).toBe('mock');
    expect(parsed.MOCK_MARKET_DATA_ENABLED).toBe(false);
    expect(parsed.PAYMENT_PROVIDER).toBe('mock');
  });

  it('accepts bounded credential-throttling configuration', () => {
    const parsed = parseRuntimeEnv({
      AUTH_LOGIN_EMAIL_MAX_ATTEMPTS: '4',
      AUTH_LOGIN_IP_MAX_ATTEMPTS: '40',
      AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: '600',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      MOCK_PAYMENT_SIGNING_SECRET:
        'test-mock-payment-secret-with-thirty-two-characters',
      NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NEXTAUTH_URL: 'http://localhost:3000',
      VALKEY_URL: 'redis://localhost:6379',
    });

    expect(parsed.AUTH_LOGIN_EMAIL_MAX_ATTEMPTS).toBe(4);
    expect(parsed.AUTH_LOGIN_IP_MAX_ATTEMPTS).toBe(40);
    expect(parsed.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS).toBe(600);
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

  it('rejects an unimplemented market-data source', () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        MARKET_DATA_SOURCE: 'tradermade',
        MOCK_PAYMENT_SIGNING_SECRET:
          'test-mock-payment-secret-with-thirty-two-characters',
        NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
        NEXTAUTH_URL: 'http://localhost:3000',
        VALKEY_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });

  it('requires NOWPayments credentials when that provider is selected', () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        MOCK_PAYMENT_SIGNING_SECRET:
          'test-mock-payment-secret-with-thirty-two-characters',
        NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
        NEXTAUTH_URL: 'https://payments.example.test',
        PAYMENT_PROVIDER: 'nowpayments',
        VALKEY_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });
});
