import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { calculateLivePositionMetrics } from './terminal-position-metrics';

describe('live terminal position metrics', () => {
  it('marks a long to the executable bid and keeps P&L in exact minor units', () => {
    expect(
      calculateLivePositionMetrics({
        ask: new Decimal('1.10020'),
        averageEntryPrice: new Decimal('1.10020'),
        bid: new Decimal('1.10000'),
        contractSize: new Decimal('100000'),
        priceScale: 5,
        quantity: new Decimal('0.10'),
        side: 'LONG',
      }),
    ).toEqual({
      markPrice: '1.1',
      unrealizedPips: '-2.0',
      unrealizedPnlMinor: '-200',
    });
  });

  it('marks a short to the executable ask', () => {
    expect(
      calculateLivePositionMetrics({
        ask: new Decimal('1.09980'),
        averageEntryPrice: new Decimal('1.10000'),
        bid: new Decimal('1.09960'),
        contractSize: new Decimal('100000'),
        priceScale: 5,
        quantity: new Decimal('0.10'),
        side: 'SHORT',
      }),
    ).toEqual({
      markPrice: '1.0998',
      unrealizedPips: '2.0',
      unrealizedPnlMinor: '200',
    });
  });

  it('does not fabricate position P&L without an executable quote', () => {
    expect(
      calculateLivePositionMetrics({
        ask: null,
        averageEntryPrice: new Decimal('1.10000'),
        bid: new Decimal('1.09980'),
        contractSize: new Decimal('100000'),
        priceScale: 5,
        quantity: new Decimal('0.10'),
        side: 'SHORT',
      }),
    ).toBeNull();
  });
});
