import type {
  CandleRangeRequest,
  MarketCandle,
  MarketCandleService,
} from '@profitopath/market-data';
import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import { WorkerBackfilledCandleService } from './twelve-data-trial-history';

const request: CandleRangeRequest = {
  from: new Date('2026-09-04T10:00:00.000Z'),
  limit: 240,
  symbol: 'EURUSD',
  timeframe: '1m',
  to: new Date('2026-09-04T14:00:00.000Z'),
};

const candle: MarketCandle = {
  close: new Decimal('1.10000'),
  closeTime: new Date('2026-09-04T10:01:00.000Z'),
  dataVersion: 1,
  high: new Decimal('1.10010'),
  isFinal: true,
  low: new Decimal('1.09990'),
  open: new Decimal('1.10000'),
  openTime: new Date('2026-09-04T10:00:00.000Z'),
  source: 'TWELVE_DATA_TRIAL',
  symbol: 'EURUSD',
  timeframe: '1m',
  volume: null,
};

describe('worker-backfilled terminal history', () => {
  it('returns durable candles immediately while worker coverage refreshes in the background', async () => {
    const getCandles = vi.fn().mockResolvedValue([candle]);
    const backfill = vi.fn(() => new Promise<void>(() => undefined));
    const service = new WorkerBackfilledCandleService(
      { getCandles } as unknown as MarketCandleService,
      { backfill } as never,
    );

    await expect(service.getCandles(request)).resolves.toEqual([candle]);
    expect(getCandles).toHaveBeenCalledOnce();
    expect(backfill).toHaveBeenCalledWith(request);
  });
});
