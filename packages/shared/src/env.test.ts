import { describe, expect, it } from 'vitest';

import {
  parseRuntimeEnv,
  serviceEnvSchema,
  workerServiceEnvSchema,
} from './env';

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
    expect(parsed.TWELVE_DATA_PRIVATE_TEST_ENABLED).toBe(false);
    expect(parsed.TWELVE_DATA_POLL_INTERVAL_MS).toBe(300_000);
    expect(parsed.PAYMENT_PROVIDER).toBe('mock');
    expect(parsed.EMAIL_PROVIDER).toBe('console');
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

  it('requires a complete isolated Twelve Data trial configuration', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      MARKET_DATA_SOURCE: 'twelve-data-trial',
      MARKET_DATA_INTERNAL_TOKEN:
        'internal-market-data-token-with-at-least-thirty-two-chars',
      MARKET_DATA_WORKER_INTERNAL_URL: 'http://worker:3002',
      MOCK_PAYMENT_SIGNING_SECRET:
        'test-mock-payment-secret-with-thirty-two-characters',
      NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NEXTAUTH_URL: 'https://staging.profitopath.example',
      TWELVE_DATA_API_KEY: 'server-only-trial-key',
      TWELVE_DATA_TRIAL_ENDS_AT: '2026-09-14T00:00:00.000Z',
      TWELVE_DATA_TRIAL_SPREAD_EURUSD: '0.00012',
      TWELVE_DATA_TRIAL_SPREAD_GBPUSD: '0.00024',
      VALKEY_URL: 'redis://localhost:6379',
    };

    expect(parseRuntimeEnv(base).MARKET_DATA_SOURCE).toBe('twelve-data-trial');
    expect(() =>
      parseRuntimeEnv({ ...base, MOCK_MARKET_DATA_ENABLED: 'true' }),
    ).toThrow('MOCK_MARKET_DATA_ENABLED');
    expect(() =>
      parseRuntimeEnv({ ...base, TWELVE_DATA_TRIAL_SPREAD_EURUSD: undefined }),
    ).toThrow('TWELVE_DATA_TRIAL_SPREAD_EURUSD');
    expect(() =>
      parseRuntimeEnv({ ...base, TWELVE_DATA_TRIAL_STAFF_ONLY: 'false' }),
    ).toThrow('TWELVE_DATA_TRIAL_STAFF_ONLY');
    expect(() =>
      parseRuntimeEnv({ ...base, MARKET_DATA_INTERNAL_TOKEN: undefined }),
    ).toThrow('MARKET_DATA_INTERNAL_TOKEN');
    expect(
      serviceEnvSchema.parse({
        ...base,
        MARKET_DATA_INTERNAL_TOKEN: undefined,
        MARKET_DATA_WORKER_INTERNAL_URL: undefined,
        PORT: '3001',
      }).MARKET_DATA_SOURCE,
    ).toBe('twelve-data-trial');
    expect(
      parseRuntimeEnv({ ...base, TWELVE_DATA_API_KEY: undefined })
        .MARKET_DATA_SOURCE,
    ).toBe('twelve-data-trial');
    expect(() =>
      workerServiceEnvSchema.parse({
        ...base,
        PORT: '3002',
        TWELVE_DATA_API_KEY: undefined,
      }),
    ).toThrow('TWELVE_DATA_API_KEY');
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

  it('requires a complete SMTP configuration when SMTP delivery is selected', () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        EMAIL_PROVIDER: 'smtp',
        MOCK_PAYMENT_SIGNING_SECRET:
          'test-mock-payment-secret-with-thirty-two-characters',
        NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
        NEXTAUTH_URL: 'https://profitopath.com',
        VALKEY_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });

  it('accepts a credentialed loopback-only Twelve Data private probe', () => {
    const parsed = workerServiceEnvSchema.parse({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      MOCK_PAYMENT_SIGNING_SECRET:
        'test-mock-payment-secret-with-thirty-two-characters',
      NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      NEXTAUTH_URL: 'http://localhost:3000',
      TWELVE_DATA_API_KEY: 'private-test-key',
      TWELVE_DATA_PRIVATE_TEST_ENABLED: 'true',
      VALKEY_URL: 'redis://localhost:6379',
    });

    expect(parsed.TWELVE_DATA_PRIVATE_TEST_ENABLED).toBe(true);
  });

  it('rejects a Twelve Data probe without a key or with a public origin', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      MOCK_PAYMENT_SIGNING_SECRET:
        'test-mock-payment-secret-with-thirty-two-characters',
      NEXTAUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
      TWELVE_DATA_PRIVATE_TEST_ENABLED: 'true',
      VALKEY_URL: 'redis://localhost:6379',
    };

    expect(() =>
      workerServiceEnvSchema.parse({
        ...base,
        NEXTAUTH_URL: 'http://localhost:3000',
      }),
    ).toThrow();
    expect(() =>
      workerServiceEnvSchema.parse({
        ...base,
        NEXTAUTH_URL: 'https://profitopath.com',
        TWELVE_DATA_API_KEY: 'private-test-key',
      }),
    ).toThrow();
  });
});
