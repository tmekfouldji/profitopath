import Decimal from 'decimal.js';

import { assertValidQuote, normalizeSymbol } from './quote-validator';
import type {
  Bar,
  HistoricalBarsRequest,
  MarketDataProvider,
  Quote,
  QuoteHandler,
} from './types';

export interface MockQuoteSeed {
  ask: string;
  bid: string;
  symbol: string;
  timestamp: Date;
}

export class MockQuoteUnavailableError extends Error {
  constructor(symbol: string) {
    super(`Mock quote is unavailable for ${symbol}`);
    this.name = 'MockQuoteUnavailableError';
  }
}

export class MockHistoricalDataUnavailableError extends Error {
  constructor() {
    super('Historical bars are not implemented in the Phase 4 mock feed');
    this.name = 'MockHistoricalDataUnavailableError';
  }
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly #handlers = new Set<QuoteHandler>();
  readonly #latest = new Map<string, Quote>();
  readonly #quotes: Quote[];
  readonly #subscribed = new Set<string>();
  #cursor = 0;

  constructor(seeds: readonly MockQuoteSeed[]) {
    this.#quotes = seeds.map((seed, index) => {
      const quote: Quote = {
        ask: new Decimal(seed.ask),
        bid: new Decimal(seed.bid),
        sequence: BigInt(index + 1),
        symbol: normalizeSymbol(seed.symbol),
        timestamp: new Date(seed.timestamp),
      };
      assertValidQuote(quote);
      return quote;
    });
  }

  async getHistoricalBars(_input: HistoricalBarsRequest): Promise<Bar[]> {
    throw new MockHistoricalDataUnavailableError();
  }

  async getLatestQuote(symbol: string): Promise<Quote> {
    const normalized = normalizeSymbol(symbol);
    const quote = this.#latest.get(normalized);
    if (quote === undefined) {
      throw new MockQuoteUnavailableError(normalized);
    }
    return quote;
  }

  onQuote(handler: QuoteHandler): void {
    this.#handlers.add(handler);
  }

  async subscribe(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      const normalized = normalizeSymbol(symbol);
      if (!this.#quotes.some((quote) => quote.symbol === normalized)) {
        throw new MockQuoteUnavailableError(normalized);
      }
      this.#subscribed.add(normalized);
    }
  }

  async publishNext(): Promise<Quote | null> {
    const quote = this.#quotes[this.#cursor];
    if (quote === undefined) {
      return null;
    }
    this.#cursor += 1;
    if (!this.#subscribed.has(quote.symbol)) {
      return quote;
    }
    this.#latest.set(quote.symbol, quote);
    for (const handler of this.#handlers) {
      await handler(quote);
    }
    return quote;
  }

  reset(): void {
    this.#cursor = 0;
    this.#latest.clear();
  }
}
