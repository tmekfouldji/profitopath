import { database } from '@profitopath/database';
import Decimal from 'decimal.js';

import { normalizeSymbol } from './quote-validator';
import type { Quote } from './types';

export type CandleTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface MarketCandle {
  close: Decimal;
  closeTime: Date;
  dataVersion: number;
  high: Decimal;
  isFinal: boolean;
  low: Decimal;
  open: Decimal;
  openTime: Date;
  source: string;
  symbol: string;
  timeframe: CandleTimeframe;
  volume: Decimal | null;
}

export interface CandleRangeRequest {
  from: Date;
  limit: number;
  sources?: readonly string[];
  symbol: string;
  timeframe: CandleTimeframe;
  to: Date;
}

export interface CandleRepository {
  findFinalRange(input: CandleRangeRequest): Promise<MarketCandle[]>;
  insertMissing(candles: readonly MarketCandle[]): Promise<void>;
}

export interface MarketCandleServiceOptions {
  baseSources?: readonly string[];
  derivedSources?: readonly string[];
}

const minuteMs = 60_000;
const timeframeMinutes: Readonly<Record<CandleTimeframe, number>> = {
  '1d': 1_440,
  '1h': 60,
  '1m': 1,
  '4h': 240,
  '5m': 5,
  '15m': 15,
};
const mockBaseSources = ['MOCK_SEED', 'MOCK_LIVE'] as const;
const mockDerivedSources = ['DERIVED_MOCK_SEED', 'DERIVED_MOCK_LIVE'] as const;

export class InvalidCandleRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCandleRangeError';
  }
}

export class OutOfOrderCandleQuoteError extends Error {
  constructor() {
    super('Quote predates the current forming candle');
    this.name = 'OutOfOrderCandleQuoteError';
  }
}

export function assertValidCandleRange(input: CandleRangeRequest): void {
  if (
    Number.isNaN(input.from.getTime()) ||
    Number.isNaN(input.to.getTime()) ||
    input.from >= input.to
  ) {
    throw new InvalidCandleRangeError(
      'Candle range must have valid increasing timestamps',
    );
  }
  if (
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 1_000
  ) {
    throw new InvalidCandleRangeError(
      'Candle range limit must be an integer from 1 to 1000',
    );
  }
}

function normalizeCandle(record: {
  close: { toString(): string };
  closeTime: Date;
  dataVersion: number;
  high: { toString(): string };
  isFinal: boolean;
  low: { toString(): string };
  open: { toString(): string };
  openTime: Date;
  source: string;
  symbol: string;
  timeframe: string;
  volume: { toString(): string } | null;
}): MarketCandle {
  if (!(record.timeframe in timeframeMinutes)) {
    throw new InvalidCandleRangeError(
      `Unsupported persisted timeframe: ${record.timeframe}`,
    );
  }
  return {
    close: new Decimal(record.close.toString()),
    closeTime: record.closeTime,
    dataVersion: record.dataVersion,
    high: new Decimal(record.high.toString()),
    isFinal: record.isFinal,
    low: new Decimal(record.low.toString()),
    open: new Decimal(record.open.toString()),
    openTime: record.openTime,
    source: record.source,
    symbol: record.symbol,
    timeframe: record.timeframe as CandleTimeframe,
    volume:
      record.volume === null ? null : new Decimal(record.volume.toString()),
  };
}

export class PrismaCandleRepository implements CandleRepository {
  async findFinalRange(input: CandleRangeRequest): Promise<MarketCandle[]> {
    const rows = await database.marketCandle.findMany({
      orderBy: { openTime: 'asc' },
      take: input.limit,
      where: {
        isFinal: true,
        openTime: { gte: input.from, lt: input.to },
        ...(input.sources === undefined
          ? {}
          : { source: { in: [...input.sources] } }),
        symbol: normalizeSymbol(input.symbol),
        timeframe: input.timeframe,
      },
    });
    return rows.map(normalizeCandle);
  }

  async insertMissing(candles: readonly MarketCandle[]): Promise<void> {
    if (candles.length === 0) {
      return;
    }
    await database.marketCandle.createMany({
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
}

function bucketStart(timestamp: Date, minutes: number): number {
  const bucketMs = minutes * minuteMs;
  return Math.floor(timestamp.getTime() / bucketMs) * bucketMs;
}

export function aggregateFinalCandles(
  source: readonly MarketCandle[],
  timeframe: Exclude<CandleTimeframe, '1m'>,
): MarketCandle[] {
  const minutes = timeframeMinutes[timeframe];
  const ordered = [...source]
    .filter((candle) => candle.timeframe === '1m' && candle.isFinal)
    .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
  const buckets = new Map<number, MarketCandle[]>();
  for (const candle of ordered) {
    const start = bucketStart(candle.openTime, minutes);
    const bucket = buckets.get(start) ?? [];
    bucket.push(candle);
    buckets.set(start, bucket);
  }
  const result: MarketCandle[] = [];
  for (const [start, candles] of [...buckets.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    const complete =
      candles.length === minutes &&
      candles.every(
        (candle, index) =>
          candle.openTime.getTime() === start + index * minuteMs &&
          candle.closeTime.getTime() === start + (index + 1) * minuteMs,
      );
    if (!complete) {
      continue;
    }
    const first = candles[0]!;
    const last = candles.at(-1)!;
    const volume = candles.every((candle) => candle.volume !== null)
      ? Decimal.sum(...candles.map((candle) => candle.volume!))
      : null;
    result.push({
      close: last.close,
      closeTime: new Date(start + minutes * minuteMs),
      dataVersion: 1,
      high: Decimal.max(...candles.map((candle) => candle.high)),
      isFinal: true,
      low: Decimal.min(...candles.map((candle) => candle.low)),
      open: first.open,
      openTime: new Date(start),
      source: `DERIVED_${first.source}`,
      symbol: first.symbol,
      timeframe,
      volume,
    });
  }
  return result;
}

function requestKey(input: CandleRangeRequest): string {
  return [
    normalizeSymbol(input.symbol),
    input.timeframe,
    input.from.toISOString(),
    input.to.toISOString(),
    input.limit,
    ...(input.sources === undefined ? [] : [...input.sources].sort()),
  ].join(':');
}

function withSources(
  input: CandleRangeRequest,
  sources: readonly string[] | undefined,
): CandleRangeRequest {
  return sources === undefined ? input : { ...input, sources };
}

export class MarketCandleService {
  readonly #baseSources: readonly string[] | undefined;
  readonly #derivedSources: readonly string[] | undefined;
  readonly #inFlight = new Map<string, Promise<MarketCandle[]>>();
  readonly #repository: CandleRepository;

  constructor(
    repository: CandleRepository = new PrismaCandleRepository(),
    options: MarketCandleServiceOptions = {},
  ) {
    this.#baseSources = options.baseSources ?? mockBaseSources;
    this.#derivedSources = options.derivedSources ?? mockDerivedSources;
    this.#repository = repository;
  }

  async getCandles(request: CandleRangeRequest): Promise<MarketCandle[]> {
    assertValidCandleRange(request);
    const input = { ...request, symbol: normalizeSymbol(request.symbol) };
    const key = requestKey(input);
    const active = this.#inFlight.get(key);
    if (active !== undefined) {
      return active;
    }
    const load = this.#load(input).finally(() => {
      this.#inFlight.delete(key);
    });
    this.#inFlight.set(key, load);
    return load;
  }

  async #load(input: CandleRangeRequest): Promise<MarketCandle[]> {
    if (input.timeframe === '1m') {
      return this.#repository.findFinalRange(
        withSources(input, this.#baseSources),
      );
    }
    const minutes = timeframeMinutes[input.timeframe];
    const source = await this.#repository.findFinalRange(
      withSources(
        {
          ...input,
          from: new Date(bucketStart(input.from, minutes)),
          limit: input.limit * minutes,
          timeframe: '1m',
        },
        this.#baseSources,
      ),
    );
    await this.#repository.insertMissing(
      aggregateFinalCandles(source, input.timeframe),
    );
    return this.#repository.findFinalRange(
      withSources(input, this.#derivedSources),
    );
  }
}

export interface CandleBuilderUpdate {
  current: MarketCandle;
  finalized: MarketCandle | null;
}

function midpoint(quote: Quote): Decimal {
  return quote.bid.plus(quote.ask).dividedBy(2);
}

export class QuoteCandleBuilder {
  #current: MarketCandle | null = null;
  readonly #source: string;

  constructor(source = 'MOCK_LIVE') {
    this.#source = source;
  }

  update(quote: Quote): CandleBuilderUpdate {
    const symbol = normalizeSymbol(quote.symbol);
    const start = bucketStart(quote.timestamp, 1);
    const price = midpoint(quote);
    if (this.#current !== null && start < this.#current.openTime.getTime()) {
      throw new OutOfOrderCandleQuoteError();
    }
    if (this.#current === null || start > this.#current.openTime.getTime()) {
      const finalized =
        this.#current === null ? null : { ...this.#current, isFinal: true };
      this.#current = {
        close: price,
        closeTime: new Date(start + minuteMs),
        dataVersion: 1,
        high: price,
        isFinal: false,
        low: price,
        open: price,
        openTime: new Date(start),
        source: this.#source,
        symbol,
        timeframe: '1m',
        volume: null,
      };
      return { current: this.#current, finalized };
    }
    this.#current = {
      ...this.#current,
      close: price,
      high: Decimal.max(this.#current.high, price),
      low: Decimal.min(this.#current.low, price),
    };
    return { current: this.#current, finalized: null };
  }
}

export function mergeHistoricalAndCurrent(
  history: readonly MarketCandle[],
  current: MarketCandle | null,
): MarketCandle[] {
  const byOpenTime = new Map(
    history.map((candle) => [candle.openTime.getTime(), candle]),
  );
  if (current !== null) {
    byOpenTime.set(current.openTime.getTime(), current);
  }
  return [...byOpenTime.values()].sort(
    (left, right) => left.openTime.getTime() - right.openTime.getTime(),
  );
}
