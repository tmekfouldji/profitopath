import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import {
  type MarketDataCoverageRange,
  TwelveDataHistoricalBackfill,
} from './twelve-data-history';
import type { MarketCandle } from './candle-service';

function rangeKey(input: MarketDataCoverageRange): string {
  return [
    input.source,
    input.symbol,
    input.timeframe,
    input.rangeStart.toISOString(),
    input.rangeEnd.toISOString(),
  ].join(':');
}

class MemoryCoverageRepository {
  readonly candles: MarketCandle[] = [];
  readonly coverage = new Map<string, MarketDataCoverageRange>();

  async isCovered(input: MarketDataCoverageRange): Promise<boolean> {
    return [...this.coverage.values()].some(
      (candidate) =>
        candidate.dataVersion === input.dataVersion &&
        candidate.source === input.source &&
        candidate.symbol === input.symbol &&
        candidate.timeframe === input.timeframe &&
        candidate.rangeStart <= input.rangeStart &&
        candidate.rangeEnd >= input.rangeEnd,
    );
  }

  async persist(
    candles: readonly MarketCandle[],
    coverage: MarketDataCoverageRange,
  ): Promise<void> {
    this.candles.push(...candles);
    this.coverage.set(rangeKey(coverage), coverage);
  }
}

class MemoryLeaseClient {
  #locked = false;

  async eval(): Promise<number> {
    this.#locked = false;
    return 1;
  }

  async set(): Promise<'OK' | null> {
    if (this.#locked) {
      return null;
    }
    this.#locked = true;
    return 'OK';
  }
}

const fixedNow = () => new Date('2026-09-04T12:00:00.000Z');

function bar() {
  return {
    close: new Decimal('1.10010'),
    high: new Decimal('1.10020'),
    low: new Decimal('1.10000'),
    open: new Decimal('1.10005'),
    openedAt: new Date('2026-09-04T11:59:00.000Z'),
    symbol: 'EURUSD',
  };
}

describe('Twelve Data historical backfill', () => {
  it('persists source-isolated finalized one-minute bars and durable coverage', async () => {
    const coverage = new MemoryCoverageRepository();
    const provider = { getHistoricalBars: vi.fn().mockResolvedValue([bar()]) };
    const backfill = new TwelveDataHistoricalBackfill({
      coverage,
      leaseClient: new MemoryLeaseClient(),
      now: fixedNow,
      provider,
    });

    const result = await backfill.backfill({
      from: new Date('2026-09-04T11:00:00.000Z'),
      symbol: 'EURUSD',
      to: new Date('2026-09-04T12:00:00.000Z'),
    });

    expect(result).toEqual({
      coalescedRanges: 0,
      fetchedBars: 1,
      fetchedRanges: 1,
      skippedRanges: 0,
    });
    expect(coverage.candles).toEqual([
      expect.objectContaining({
        close: expect.objectContaining({ toString: expect.any(Function) }),
        isFinal: true,
        source: 'TWELVE_DATA_TRIAL',
        symbol: 'EURUSD',
        timeframe: '1m',
      }),
    ]);
    expect(coverage.candles[0]?.close.toString()).toBe('1.1001');
    expect(provider.getHistoricalBars).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2026-09-04T00:00:00.000Z'),
        limit: 720,
        to: new Date('2026-09-04T12:00:00.000Z'),
      }),
    );

    const replay = await backfill.backfill({
      from: new Date('2026-09-04T11:00:00.000Z'),
      symbol: 'EURUSD',
      to: new Date('2026-09-04T12:00:00.000Z'),
    });
    expect(replay.skippedRanges).toBe(1);
    expect(provider.getHistoricalBars).toHaveBeenCalledTimes(1);
  });

  it('coalesces a missing range across worker instances through the shared lease', async () => {
    const coverage = new MemoryCoverageRepository();
    const lease = new MemoryLeaseClient();
    let completeFirstFetch: (() => void) | undefined;
    const firstFetchComplete = new Promise<void>((resolve) => {
      completeFirstFetch = resolve;
    });
    const provider = {
      getHistoricalBars: vi.fn().mockImplementation(async () => {
        await firstFetchComplete;
        return [bar()];
      }),
    };
    const input = {
      from: new Date('2026-09-04T11:00:00.000Z'),
      symbol: 'EURUSD',
      to: new Date('2026-09-04T12:00:00.000Z'),
    };
    const first = new TwelveDataHistoricalBackfill({
      coverage,
      leaseClient: lease,
      now: fixedNow,
      provider,
    });
    const second = new TwelveDataHistoricalBackfill({
      coverage,
      leaseClient: lease,
      now: fixedNow,
      provider,
      wait: () => firstFetchComplete,
    });

    const firstResult = first.backfill(input);
    await vi.waitFor(() => {
      expect(provider.getHistoricalBars).toHaveBeenCalledTimes(1);
    });
    const secondResult = second.backfill(input);
    completeFirstFetch!();

    await expect(firstResult).resolves.toMatchObject({ fetchedRanges: 1 });
    await expect(secondResult).resolves.toMatchObject({ coalescedRanges: 1 });
    expect(provider.getHistoricalBars).toHaveBeenCalledTimes(1);
  });
});
