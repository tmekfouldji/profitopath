import { describe, expect, it } from 'vitest';

import { createDevelopmentCandleSeeds } from './candle-seeds';

describe('development candle seeds', () => {
  it('creates deterministic final one-minute history for both mock symbols', () => {
    const start = new Date('2026-08-24T00:00:00.000Z');
    const first = createDevelopmentCandleSeeds(start);
    const retry = createDevelopmentCandleSeeds(start);

    expect(first).toEqual(retry);
    expect(first).toHaveLength(480);
    expect(first[0]).toMatchObject({
      isFinal: true,
      source: 'MOCK_SEED',
      symbol: 'EURUSD',
      timeframe: '1m',
    });
    expect(first[0]?.openTime.toISOString()).toBe('2026-08-21T20:00:00.000Z');
    expect(first[239]?.closeTime.toISOString()).toBe(
      '2026-08-22T00:00:00.000Z',
    );
    expect(first[240]?.symbol).toBe('GBPUSD');
  });
});
