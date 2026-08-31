import Decimal from 'decimal.js';

import { MarketCandleService, type CandleTimeframe } from './candle-service';
import { assertValidQuote, normalizeSymbol } from './quote-validator';
import type {
  Bar,
  HistoricalBarsRequest,
  MarketDataProvider,
  Quote,
  QuoteHandler,
} from './types';

export interface QuoteCacheClient {
  connect?(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  publish?(channel: string, message: string): Promise<unknown>;
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    expirySeconds: number,
  ): Promise<unknown>;
  status?: string;
}

export interface QuoteStore {
  get(symbol: string): Promise<Quote | null>;
  publish(quote: Quote): Promise<void>;
}

export class CachedQuoteUnavailableError extends Error {
  constructor(symbol: string) {
    super(`Cached quote is unavailable for ${symbol}`);
    this.name = 'CachedQuoteUnavailableError';
  }
}

function quoteKey(symbol: string): string {
  return `market:quote:v1:${normalizeSymbol(symbol)}`;
}

export class ValkeyQuoteStore implements QuoteStore {
  readonly #client: QuoteCacheClient;
  #connectPromise: Promise<unknown> | undefined;
  readonly #now: () => Date;
  readonly #ttlSeconds: number;

  constructor(
    client: QuoteCacheClient,
    ttlSeconds = 30,
    now: () => Date = () => new Date(),
  ) {
    this.#client = client;
    this.#now = now;
    this.#ttlSeconds = ttlSeconds;
  }

  async publish(quote: Quote): Promise<void> {
    await this.#ensureConnected();
    assertValidQuote(quote);
    const normalized = { ...quote, symbol: normalizeSymbol(quote.symbol) };
    const payload = JSON.stringify({
      ask: normalized.ask.toString(),
      bid: normalized.bid.toString(),
      sequence: normalized.sequence.toString(),
      symbol: normalized.symbol,
      timestamp: normalized.timestamp.toISOString(),
    });
    await this.#client.set(
      quoteKey(normalized.symbol),
      payload,
      'EX',
      this.#ttlSeconds,
    );
    await this.#client.publish?.('market:quotes:v1', payload);
  }

  async get(symbol: string): Promise<Quote | null> {
    await this.#ensureConnected();
    const value = await this.#client.get(quoteKey(symbol));
    if (value === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('ask' in parsed) ||
      !('bid' in parsed) ||
      !('sequence' in parsed) ||
      !('symbol' in parsed) ||
      !('timestamp' in parsed)
    ) {
      throw new CachedQuoteUnavailableError(normalizeSymbol(symbol));
    }
    const quote: Quote = {
      ask: new Decimal(String(parsed.ask)),
      bid: new Decimal(String(parsed.bid)),
      sequence: BigInt(String(parsed.sequence)),
      symbol: normalizeSymbol(String(parsed.symbol)),
      timestamp: new Date(String(parsed.timestamp)),
    };
    assertValidQuote(quote);
    if (
      quote.symbol !== normalizeSymbol(symbol) ||
      this.#now().getTime() - quote.timestamp.getTime() >
        this.#ttlSeconds * 1_000
    ) {
      throw new CachedQuoteUnavailableError(normalizeSymbol(symbol));
    }
    return quote;
  }

  async #ensureConnected(): Promise<void> {
    if (this.#connectPromise !== undefined) {
      await this.#connectPromise;
      return;
    }
    if (this.#client.status === 'wait' && this.#client.connect !== undefined) {
      this.#connectPromise = this.#client.connect().finally(() => {
        this.#connectPromise = undefined;
      });
      await this.#connectPromise;
    }
  }
}

export class CachedMarketDataProvider implements MarketDataProvider {
  readonly #candles: MarketCandleService;
  readonly #quotes: QuoteStore;

  constructor(
    quotes: QuoteStore,
    candles: MarketCandleService = new MarketCandleService(),
  ) {
    this.#quotes = quotes;
    this.#candles = candles;
  }

  async getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]> {
    const candles = await this.#candles.getCandles({
      ...input,
      timeframe: input.timeframe as CandleTimeframe,
    });
    return candles.map((candle) => ({
      close: candle.close,
      high: candle.high,
      low: candle.low,
      open: candle.open,
      openedAt: candle.openTime,
      symbol: candle.symbol,
    }));
  }

  async getLatestQuote(symbol: string): Promise<Quote> {
    const quote = await this.#quotes.get(symbol);
    if (quote === null) {
      throw new CachedQuoteUnavailableError(normalizeSymbol(symbol));
    }
    return quote;
  }

  onQuote(_handler: QuoteHandler): void {
    // HTTP command adapters read the shared cache; realtime subscription is worker/gateway-owned.
  }

  async subscribe(_symbols: string[]): Promise<void> {
    // The shared cache is populated by the worker-owned provider subscription.
  }
}
