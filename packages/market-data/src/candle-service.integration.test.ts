import { database } from '@profitopath/database';
import Decimal from 'decimal.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type MarketCandle,
  MarketCandleService,
  PrismaCandleRepository,
} from './candle-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const symbols: string[] = [];

function sourceCandle(symbol: string, index: number): MarketCandle {
  const openTime = new Date(Date.UTC(2026, 7, 24, 9, index));
  const open = new Decimal('1.10000').plus(
    new Decimal(index).dividedBy(100_000),
  );
  return {
    close: open.plus('0.00001'),
    closeTime: new Date(openTime.getTime() + 60_000),
    dataVersion: 1,
    high: open.plus('0.00002'),
    isFinal: true,
    low: open.minus('0.00001'),
    open,
    openTime,
    source: 'MOCK_TEST',
    symbol,
    timeframe: '1m',
    volume: null,
  };
}

afterEach(async () => {
  await database.marketCandle.deleteMany({
    where: { symbol: { in: symbols.splice(0) } },
  });
});

integrationTest('PostgreSQL candle persistence', () => {
  it('deduplicates base candles and persists one complete derived bucket', async () => {
    const symbol = `TEST${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    symbols.push(symbol);
    const repository = new PrismaCandleRepository();
    const source = Array.from({ length: 5 }, (_, index) =>
      sourceCandle(symbol, index),
    );
    await repository.insertMissing(source);
    await repository.insertMissing(source);
    await expect(
      database.marketCandle.count({ where: { symbol, timeframe: '1m' } }),
    ).resolves.toBe(5);

    const service = new MarketCandleService(repository, {
      baseSources: ['MOCK_TEST'],
      derivedSources: ['DERIVED_MOCK_TEST'],
    });
    const derived = await service.getCandles({
      from: new Date('2026-08-24T09:00:00.000Z'),
      limit: 10,
      symbol,
      timeframe: '5m',
      to: new Date('2026-08-24T09:05:00.000Z'),
    });

    expect(derived).toHaveLength(1);
    await expect(
      database.marketCandle.count({ where: { symbol, timeframe: '5m' } }),
    ).resolves.toBe(1);
  });
});
