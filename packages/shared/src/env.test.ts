import { describe, expect, it } from 'vitest';

import { parseRuntimeEnv } from './env';

describe('parseRuntimeEnv', () => {
  it('parses valid service configuration', () => {
    const parsed = parseRuntimeEnv({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      VALKEY_URL: 'redis://localhost:6379',
    });

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.BUSINESS_TIMEZONE).toBe('UTC');
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: 'mysql://localhost/app',
        VALKEY_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });
});
