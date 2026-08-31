import Decimal from 'decimal.js';

import { normalizeSymbol } from './quote-validator';

const twelveDataPriceEndpoint = 'https://api.twelvedata.com/price';

const providerSymbols = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
} as const;

export const twelveDataPrivateTestSymbols = Object.freeze(
  Object.keys(providerSymbols),
) as ReadonlyArray<keyof typeof providerSymbols>;

export interface TwelveDataMidpoint {
  midpoint: Decimal;
  receivedAt: Date;
  symbol: keyof typeof providerSymbols;
}

export interface TwelveDataPrivateProbeOptions {
  apiKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

export class TwelveDataPrivateProbeError extends Error {
  constructor(message: string) {
    super(`Twelve Data private probe failed: ${message}`);
    this.name = 'TwelveDataPrivateProbeError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function providerSymbolFor(
  symbol: string,
): keyof typeof providerSymbols | undefined {
  const normalized = normalizeSymbol(symbol);
  return Object.hasOwn(providerSymbols, normalized)
    ? (normalized as keyof typeof providerSymbols)
    : undefined;
}

function parsePrice(payload: unknown, providerSymbol: string): Decimal {
  if (!isRecord(payload)) {
    throw new TwelveDataPrivateProbeError('provider returned a malformed body');
  }

  if (payload.status === 'error' || typeof payload.code === 'number') {
    throw new TwelveDataPrivateProbeError('provider rejected the request');
  }

  const value =
    typeof payload.price === 'string'
      ? payload.price
      : isRecord(payload[providerSymbol]) &&
          typeof payload[providerSymbol].price === 'string'
        ? payload[providerSymbol].price
        : undefined;
  if (value === undefined) {
    throw new TwelveDataPrivateProbeError('provider response has no price');
  }

  let midpoint: Decimal;
  try {
    midpoint = new Decimal(value);
  } catch {
    throw new TwelveDataPrivateProbeError('provider returned an invalid price');
  }
  if (!midpoint.isFinite() || !midpoint.isPositive()) {
    throw new TwelveDataPrivateProbeError('provider returned an invalid price');
  }
  return midpoint;
}

/**
 * A deliberately narrow Basic-plan connectivity check. It never implements
 * MarketDataProvider, so its midpoint values cannot enter quote fan-out or
 * simulated execution without a separately approved Phase 9 adapter.
 */
export class TwelveDataPrivateProbe {
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #subscribed = new Set<keyof typeof providerSymbols>();

  constructor(options: TwelveDataPrivateProbeOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new TwelveDataPrivateProbeError('API key is missing');
    }
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async subscribe(symbols: readonly string[]): Promise<void> {
    for (const symbol of symbols) {
      const normalized = providerSymbolFor(symbol);
      if (normalized === undefined) {
        throw new TwelveDataPrivateProbeError(
          `unsupported test symbol ${normalizeSymbol(symbol)}`,
        );
      }
      this.#subscribed.add(normalized);
    }
  }

  async sample(): Promise<readonly TwelveDataMidpoint[]> {
    const symbols = [...this.#subscribed].sort();
    if (symbols.length === 0) {
      return [];
    }

    const request = new URL(twelveDataPriceEndpoint);
    request.searchParams.set(
      'symbol',
      symbols.map((symbol) => providerSymbols[symbol]).join(','),
    );
    request.searchParams.set('apikey', this.#apiKey);

    let response: Response;
    try {
      response = await this.#fetch(request);
    } catch {
      throw new TwelveDataPrivateProbeError('network request failed');
    }
    if (!response.ok) {
      throw new TwelveDataPrivateProbeError(
        `provider returned HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new TwelveDataPrivateProbeError('provider returned non-JSON data');
    }

    const receivedAt = this.#now();
    if (Number.isNaN(receivedAt.getTime())) {
      throw new TwelveDataPrivateProbeError('clock returned an invalid time');
    }
    return symbols.map((symbol) => ({
      midpoint: parsePrice(payload, providerSymbols[symbol]),
      receivedAt,
      symbol,
    }));
  }
}
