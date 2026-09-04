import { database } from '@profitopath/database';
import Decimal from 'decimal.js';

import type { MarketCandle } from './candle-service';
import { normalizeSymbol } from './quote-validator';
import type { Bar, HistoricalBarsRequest } from './types';

const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const source = 'TWELVE_DATA_TRIAL';
const timeframe = '1m' as const;
const rangeLeaseMilliseconds = 30_000;

const releaseLeaseScript = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;

export interface TwelveDataHistoricalProvider {
  getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]>;
}

export interface TwelveDataHistoryLeaseClient {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    expiryMilliseconds: number,
    condition: 'NX',
  ): Promise<'OK' | null>;
}

export interface MarketDataCoverageRange {
  dataVersion: number;
  rangeEnd: Date;
  rangeStart: Date;
  source: string;
  symbol: string;
  timeframe: '1m';
}

export interface MarketDataCoverageRepository {
  isCovered(input: MarketDataCoverageRange): Promise<boolean>;
  persist(
    candles: readonly MarketCandle[],
    coverage: MarketDataCoverageRange,
  ): Promise<void>;
}

export class TwelveDataHistoryError extends Error {
  constructor(message: string) {
    super(`Twelve Data historical backfill failed: ${message}`);
    this.name = 'TwelveDataHistoryError';
  }
}

export interface TwelveDataBackfillResult {
  coalescedRanges: number;
  fetchedBars: number;
  fetchedRanges: number;
  skippedRanges: number;
}

function utcDayStart(value: Date): Date {
  return new Date(Math.floor(value.getTime() / dayMs) * dayMs);
}

function utcMinuteFloor(value: Date): Date {
  return new Date(Math.floor(value.getTime() / minuteMs) * minuteMs);
}

function rangeKey(symbol: string, rangeStart: Date, rangeEnd: Date): string {
  return [
    'market:history:lease:v1',
    source,
    symbol,
    timeframe,
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
  ].join(':');
}

function requestKey(symbol: string, from: Date, to: Date): string {
  return `${symbol}:${from.toISOString()}:${to.toISOString()}`;
}

function assertRange(from: Date, to: Date): void {
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to
  ) {
    throw new TwelveDataHistoryError(
      'range must have valid increasing timestamps',
    );
  }
  if (from.getTime() % minuteMs !== 0 || to.getTime() % minuteMs !== 0) {
    throw new TwelveDataHistoryError(
      'range must align to UTC minute boundaries',
    );
  }
}

function canonicalRanges(
  from: Date,
  to: Date,
  now: Date,
): MarketDataCoverageRange[] {
  const latest = utcMinuteFloor(now);
  const boundedEnd = new Date(Math.min(to.getTime(), latest.getTime()));
  if (from >= boundedEnd) {
    return [];
  }
  const ranges: MarketDataCoverageRange[] = [];
  for (
    let cursor = utcDayStart(from);
    cursor < boundedEnd;
    cursor = new Date(cursor.getTime() + dayMs)
  ) {
    const rangeStart = cursor;
    const rangeEnd = new Date(
      Math.min(cursor.getTime() + dayMs, boundedEnd.getTime()),
    );
    ranges.push({
      dataVersion: 1,
      rangeEnd,
      rangeStart,
      source,
      symbol: '',
      timeframe,
    });
  }
  return ranges;
}

function candlesFromBars(
  bars: readonly Bar[],
  coverage: MarketDataCoverageRange,
): MarketCandle[] {
  return bars.map((bar) => {
    const openedAt = bar.openedAt;
    if (
      Number.isNaN(openedAt.getTime()) ||
      openedAt.getTime() % minuteMs !== 0 ||
      openedAt < coverage.rangeStart ||
      openedAt >= coverage.rangeEnd
    ) {
      throw new TwelveDataHistoryError(
        'provider returned a bar outside its range',
      );
    }
    return {
      close: new Decimal(bar.close.toString()),
      closeTime: new Date(openedAt.getTime() + minuteMs),
      dataVersion: coverage.dataVersion,
      high: new Decimal(bar.high.toString()),
      isFinal: true,
      low: new Decimal(bar.low.toString()),
      open: new Decimal(bar.open.toString()),
      openTime: openedAt,
      source: coverage.source,
      symbol: coverage.symbol,
      timeframe: coverage.timeframe,
      volume: null,
    };
  });
}

export class PrismaMarketDataCoverageRepository implements MarketDataCoverageRepository {
  async isCovered(input: MarketDataCoverageRange): Promise<boolean> {
    const coverage = await database.marketDataCoverage.findFirst({
      select: { id: true },
      where: {
        dataVersion: input.dataVersion,
        rangeEnd: { gte: input.rangeEnd },
        rangeStart: { lte: input.rangeStart },
        source: input.source,
        symbol: input.symbol,
        timeframe: input.timeframe,
      },
    });
    return coverage !== null;
  }

  async persist(
    candles: readonly MarketCandle[],
    coverage: MarketDataCoverageRange,
  ): Promise<void> {
    await database.$transaction(async (transaction) => {
      if (candles.length > 0) {
        await transaction.marketCandle.createMany({
          data: candles.map((candle) => ({
            close: candle.close.toString(),
            closeTime: candle.closeTime,
            dataVersion: candle.dataVersion,
            high: candle.high.toString(),
            isFinal: candle.isFinal,
            low: candle.low.toString(),
            open: candle.open.toString(),
            openTime: candle.openTime,
            source: candle.source,
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            volume: candle.volume?.toString() ?? null,
          })),
          skipDuplicates: true,
        });
      }
      await transaction.marketDataCoverage.upsert({
        create: coverage,
        update: { completedAt: new Date() },
        where: {
          source_symbol_timeframe_rangeStart_rangeEnd: {
            rangeEnd: coverage.rangeEnd,
            rangeStart: coverage.rangeStart,
            source: coverage.source,
            symbol: coverage.symbol,
            timeframe: coverage.timeframe,
          },
        },
      });
    });
  }
}

/**
 * Worker-owned bounded UTC-minute backfill. It persists coverage even when a
 * market is closed and the provider returns no bars, so a chart never hammers
 * the upstream endpoint for known-empty intervals.
 */
export class TwelveDataHistoricalBackfill {
  readonly #coverage: MarketDataCoverageRepository;
  readonly #inFlight = new Map<string, Promise<TwelveDataBackfillResult>>();
  readonly #leaseClient: TwelveDataHistoryLeaseClient;
  readonly #now: () => Date;
  readonly #provider: TwelveDataHistoricalProvider;
  readonly #wait: (milliseconds: number) => Promise<void>;

  constructor(input: {
    coverage?: MarketDataCoverageRepository;
    leaseClient: TwelveDataHistoryLeaseClient;
    now?: () => Date;
    provider: TwelveDataHistoricalProvider;
    wait?: (milliseconds: number) => Promise<void>;
  }) {
    this.#coverage = input.coverage ?? new PrismaMarketDataCoverageRepository();
    this.#leaseClient = input.leaseClient;
    this.#now = input.now ?? (() => new Date());
    this.#provider = input.provider;
    this.#wait =
      input.wait ??
      ((milliseconds) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  }

  async backfill(input: {
    from: Date;
    symbol: string;
    to: Date;
  }): Promise<TwelveDataBackfillResult> {
    assertRange(input.from, input.to);
    const normalizedSymbol = normalizeSymbol(input.symbol);
    const key = requestKey(normalizedSymbol, input.from, input.to);
    const existing = this.#inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const work = this.#backfill(normalizedSymbol, input.from, input.to).finally(
      () => this.#inFlight.delete(key),
    );
    this.#inFlight.set(key, work);
    return work;
  }

  async #backfill(
    symbol: string,
    from: Date,
    to: Date,
  ): Promise<TwelveDataBackfillResult> {
    const result: TwelveDataBackfillResult = {
      coalescedRanges: 0,
      fetchedBars: 0,
      fetchedRanges: 0,
      skippedRanges: 0,
    };
    for (const range of canonicalRanges(from, to, this.#now())) {
      const coverage = { ...range, symbol };
      if (await this.#coverage.isCovered(coverage)) {
        result.skippedRanges += 1;
        continue;
      }
      const leaseToken = crypto.randomUUID();
      const leaseKey = rangeKey(symbol, coverage.rangeStart, coverage.rangeEnd);
      const acquired = await this.#leaseClient.set(
        leaseKey,
        leaseToken,
        'PX',
        rangeLeaseMilliseconds,
        'NX',
      );
      if (acquired !== 'OK') {
        result.coalescedRanges += 1;
        await this.#waitForCoverage(coverage);
        continue;
      }
      try {
        if (await this.#coverage.isCovered(coverage)) {
          result.skippedRanges += 1;
          continue;
        }
        const minutes =
          (coverage.rangeEnd.getTime() - coverage.rangeStart.getTime()) /
          minuteMs;
        const bars = await this.#provider.getHistoricalBars({
          from: coverage.rangeStart,
          limit: minutes,
          symbol,
          timeframe,
          to: coverage.rangeEnd,
        });
        const candles = candlesFromBars(bars, coverage);
        await this.#coverage.persist(candles, coverage);
        result.fetchedBars += candles.length;
        result.fetchedRanges += 1;
      } finally {
        await this.#leaseClient.eval(
          releaseLeaseScript,
          1,
          leaseKey,
          leaseToken,
        );
      }
    }
    return result;
  }

  async #waitForCoverage(coverage: MarketDataCoverageRange): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await this.#coverage.isCovered(coverage)) {
        return;
      }
      await this.#wait(250);
    }
    throw new TwelveDataHistoryError(
      'another worker did not complete the range before its lease wait elapsed',
    );
  }
}
