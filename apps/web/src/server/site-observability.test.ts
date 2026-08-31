import { describe, expect, it } from 'vitest';

import {
  configurationHealth,
  hashAnonymousVisitor,
  normalizeVisitedPath,
  utcCalendarDay,
} from './site-observability';

describe('site observability boundaries', () => {
  it('stores only a stable one-way anonymous visitor identifier', () => {
    const hash = hashAnonymousVisitor('browser-only-random-identifier');

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('browser-only-random-identifier');
  });

  it('uses a UTC day and strips untrusted visit-path details', () => {
    expect(utcCalendarDay(new Date('2026-08-30T23:59:59.999-04:00'))).toEqual(
      new Date('2026-08-31T00:00:00.000Z'),
    );
    expect(normalizeVisitedPath('/competitions?email=private#section')).toBe(
      '/competitions',
    );
    expect(normalizeVisitedPath('//other.example/')).toBe('/');
    expect(normalizeVisitedPath('https://other.example/')).toBe('/');
  });

  it('reports secret readiness without copying secret values', () => {
    const health = configurationHealth({
      emailProvider: 'smtp',
      marketDataSource: 'mock',
      mockMarketDataEnabled: false,
      nowPaymentsApiKeyConfigured: true,
      nowPaymentsIpnSecretConfigured: true,
      paymentProvider: 'mock',
      publicOrigin: 'https://profitopath.com',
      twelveDataPrivateTestEnabled: false,
    });

    expect(health.nowPayments).toBe('Credentials ready — mock checkout active');
    expect(health.email).toBe('SMTP verification enabled');
    expect(Object.values(health).join(' ')).not.toContain('api-key-value');
  });
});
