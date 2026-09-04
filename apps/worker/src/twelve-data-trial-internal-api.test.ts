import { describe, expect, it } from 'vitest';

import {
  hasInternalMarketDataAuthorization,
  parseTrialBackfillRequest,
  TwelveDataTrialInternalApiError,
} from './twelve-data-trial-internal-api';

describe('Twelve Data internal backfill API guards', () => {
  it('accepts only the shared server token and approved bounded UTC-minute ranges', () => {
    const token = 'internal-market-data-token-with-at-least-thirty-two-chars';
    expect(hasInternalMarketDataAuthorization(`Bearer ${token}`, token)).toBe(
      true,
    );
    expect(hasInternalMarketDataAuthorization('Bearer wrong', token)).toBe(
      false,
    );

    expect(
      parseTrialBackfillRequest(
        {
          from: '2026-09-04T08:00:00.000Z',
          symbol: 'eurusd',
          to: '2026-09-04T09:00:00.000Z',
        },
        120,
      ),
    ).toEqual({
      from: new Date('2026-09-04T08:00:00.000Z'),
      symbol: 'EURUSD',
      to: new Date('2026-09-04T09:00:00.000Z'),
    });
  });

  it('rejects malformed, oversized, non-minute and unsupported requests', () => {
    for (const value of [
      {},
      {
        from: '2026-09-04T08:00:30.000Z',
        symbol: 'EURUSD',
        to: '2026-09-04T09:00:00.000Z',
      },
      {
        from: '2026-09-04T08:00:00.000Z',
        symbol: 'USDJPY',
        to: '2026-09-04T09:00:00.000Z',
      },
      {
        from: '2026-09-04T08:00:00.000Z',
        symbol: 'EURUSD',
        to: '2026-09-04T12:00:00.000Z',
      },
    ]) {
      expect(() => parseTrialBackfillRequest(value, 120)).toThrow(
        TwelveDataTrialInternalApiError,
      );
    }
  });
});
