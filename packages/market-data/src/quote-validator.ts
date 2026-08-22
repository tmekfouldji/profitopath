import Decimal from 'decimal.js';

import type { Quote } from './types';

export class InvalidQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuoteError';
  }
}

export class OutOfOrderQuoteError extends InvalidQuoteError {
  constructor(symbol: string) {
    super(`Quote sequence is not monotonic for ${symbol}`);
    this.name = 'OutOfOrderQuoteError';
  }
}

export class StaleQuoteError extends InvalidQuoteError {
  constructor(symbol: string) {
    super(`Quote is stale for ${symbol}`);
    this.name = 'StaleQuoteError';
  }
}

export function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{3,32}$/.test(normalized)) {
    throw new InvalidQuoteError('Quote symbol is invalid');
  }
  return normalized;
}

export function assertValidQuote(quote: Quote): void {
  normalizeSymbol(quote.symbol);
  if (
    !Decimal.isDecimal(quote.bid) ||
    !Decimal.isDecimal(quote.ask) ||
    !quote.bid.isFinite() ||
    !quote.ask.isFinite() ||
    !quote.bid.isPositive() ||
    !quote.ask.isPositive()
  ) {
    throw new InvalidQuoteError('Quote prices must be positive Decimals');
  }
  if (quote.ask.lessThan(quote.bid)) {
    throw new InvalidQuoteError(
      'Quote ask must be greater than or equal to bid',
    );
  }
  if (quote.sequence <= 0n) {
    throw new InvalidQuoteError('Quote sequence must be positive');
  }
  if (Number.isNaN(quote.timestamp.getTime())) {
    throw new InvalidQuoteError('Quote timestamp is invalid');
  }
}

export class ValidatedQuoteBook {
  readonly #latest = new Map<string, Quote>();
  readonly #maxAgeMs: number;

  constructor(maxAgeMs: number) {
    if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) {
      throw new Error('Quote max age must be a positive safe integer');
    }
    this.#maxAgeMs = maxAgeMs;
  }

  accept(quote: Quote, receivedAt: Date): boolean {
    assertValidQuote(quote);
    const symbol = normalizeSymbol(quote.symbol);
    if (receivedAt.getTime() - quote.timestamp.getTime() > this.#maxAgeMs) {
      throw new StaleQuoteError(symbol);
    }
    const existing = this.#latest.get(symbol);
    if (existing !== undefined) {
      if (quote.sequence < existing.sequence) {
        throw new OutOfOrderQuoteError(symbol);
      }
      if (quote.sequence === existing.sequence) {
        if (
          quote.bid.equals(existing.bid) &&
          quote.ask.equals(existing.ask) &&
          quote.timestamp.getTime() === existing.timestamp.getTime()
        ) {
          return false;
        }
        throw new OutOfOrderQuoteError(symbol);
      }
    }
    this.#latest.set(symbol, { ...quote, symbol });
    return true;
  }

  get(symbol: string): Quote | undefined {
    return this.#latest.get(normalizeSymbol(symbol));
  }

  values(): Quote[] {
    return [...this.#latest.values()].sort((left, right) =>
      left.symbol.localeCompare(right.symbol),
    );
  }
}
