import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import {
  aggregateFinalCandles,
  type CandleRangeRequest,
  type CandleRepository,
  type MarketCandle,
  MarketCandleService,
  mergeHistoricalAndCurrent,
  QuoteCandleBuilder,
} from './candle-service';

function candle(index: number, symbol = 'EURUSD'): MarketCandle {
  const open = new Decimal('1.10000').plus(
    new Decimal(index).dividedBy(100_000),
  );
  return {
    close: open.plus('0.00001'),
    closeTime: new Date(Date.UTC(2026, 7, 24, 9, index + 1)),
    dataVersion: 1,
    high: open.plus('0.00002'),
    isFinal: true,
    low: open.minus('0.00001'),
    open,
    openTime: new Date(Date.UTC(2026, 7, 24, 9, index)),
    source: 'MOCK_SEED',
    symbol,
    timeframe: '1m',
    volume: null,
  };
}

describe('market candle service', () => {
  it('aggregates complete 5m, 15m, and 1h buckets with exact OHLC', () => {
    const source = Array.from({ length: 60 }, (_, index) => candle(index));
    const fiveMinute = aggregateFinalCandles(source, '5m');
    const fifteenMinute = aggregateFinalCandles(source, '15m');
    const hourly = aggregateFinalCandles(source, '1h');

    expect(fiveMinute).toHaveLength(12);
    expect(fifteenMinute).toHaveLength(4);
    expect(hourly).toHaveLength(1);
    expect(fifteenMinute[0]?.open.toString()).toBe('1.1');
    expect(fifteenMinute[0]?.close.toString()).toBe('1.10015');
    expect(fifteenMinute[0]?.high.toString()).toBe('1.10016');
    expect(fifteenMinute[0]?.low.toString()).toBe('1.09999');
    expect(hourly[0]?.close.toString()).toBe('1.1006');
  });

  it('does not derive an incomplete bucket', () => {
    expect(
      aggregateFinalCandles([candle(0), candle(1), candle(3), candle(4)], '5m'),
    ).toEqual([]);
  });

  it('coalesces 100 identical range loads into one repository read', async () => {
    const input: CandleRangeRequest = {
      from: new Date('2026-08-24T09:00:00.000Z'),
      limit: 100,
      symbol: 'eurusd',
      timeframe: '1m',
      to: new Date('2026-08-24T10:00:00.000Z'),
    };
    const findFinalRange = vi.fn(async () => {
      await Promise.resolve();
      return [candle(0)];
    });
    const repository: CandleRepository = {
      findFinalRange,
      insertMissing: vi.fn(),
    };
    const service = new MarketCandleService(repository);

    const results = await Promise.all(
      Array.from({ length: 100 }, () => service.getCandles(input)),
    );

    expect(findFinalRange).toHaveBeenCalledOnce();
    expect(results.every((result) => result.length === 1)).toBe(true);
  });

  it('builds midpoint live candles and replaces the handoff bucket', () => {
    const builder = new QuoteCandleBuilder();
    const first = builder.update({
      ask: new Decimal('1.10020'),
      bid: new Decimal('1.10000'),
      sequence: 1n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:10.000Z'),
    });
    const updated = builder.update({
      ask: new Decimal('1.10040'),
      bid: new Decimal('1.10020'),
      sequence: 2n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:40.000Z'),
    });
    const next = builder.update({
      ask: new Decimal('1.10030'),
      bid: new Decimal('1.10010'),
      sequence: 3n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:01:00.000Z'),
    });

    expect(first.current.open.toString()).toBe('1.1001');
    expect(updated.current.high.toString()).toBe('1.1003');
    expect(next.finalized?.close.toString()).toBe('1.1003');
    expect(
      mergeHistoricalAndCurrent([next.finalized!], next.current),
    ).toHaveLength(2);
    expect(mergeHistoricalAndCurrent([first.current], updated.current)).toEqual(
      [updated.current],
    );
  });
});
