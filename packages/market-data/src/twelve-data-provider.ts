import Decimal from 'decimal.js';
import WebSocket from 'ws';

import { assertValidQuote, normalizeSymbol } from './quote-validator';
import type {
  Bar,
  HistoricalBarsRequest,
  MarketDataProvider,
  Quote,
  QuoteHandler,
} from './types';

const historicalEndpoint = 'https://api.twelvedata.com/time_series';
const websocketEndpoint = 'wss://ws.twelvedata.com/v1/quotes/price';
const heartbeatIntervalMs = 10_000;
const providerTimestampToleranceMs = 65_000;

const providerSymbols = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
} as const;

const providerIntervals = {
  '1d': '1day',
  '1h': '1h',
  '1m': '1min',
  '4h': '4h',
  '5m': '5min',
  '15m': '15min',
} as const;

export const twelveDataTrialSymbols = Object.freeze(
  Object.keys(providerSymbols),
) as ReadonlyArray<keyof typeof providerSymbols>;

export class TwelveDataProviderError extends Error {
  constructor(message: string) {
    super(`Twelve Data provider failed: ${message}`);
    this.name = 'TwelveDataProviderError';
  }
}

export class TwelveDataQuoteUnavailableError extends TwelveDataProviderError {
  constructor(symbol: string) {
    super(`no current quote is available for ${symbol}`);
    this.name = 'TwelveDataQuoteUnavailableError';
  }
}

export class TwelveDataTrialExpiredError extends TwelveDataProviderError {
  constructor(endsAt: Date) {
    super(`the commercial trial expired at ${endsAt.toISOString()}`);
    this.name = 'TwelveDataTrialExpiredError';
  }
}

export interface TwelveDataMarketDataProviderOptions {
  apiKey: string;
  fetch?: typeof fetch;
  fullSpreads: Readonly<Record<string, string>>;
  now?: () => Date;
  onFault?: (error: TwelveDataProviderError) => void;
  quoteMaxAgeMs?: number;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  sequence?: () => bigint | Promise<bigint>;
  trialEndsAt: Date;
  webSocketFactory?: (url: string) => WebSocket;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function providerSymbolFor(symbol: string): keyof typeof providerSymbols {
  const normalized = normalizeSymbol(symbol);
  if (!Object.hasOwn(providerSymbols, normalized)) {
    throw new TwelveDataProviderError(
      `unsupported Twelve Data trial symbol ${normalized}`,
    );
  }
  return normalized as keyof typeof providerSymbols;
}

function normalizedSymbolForProvider(
  value: unknown,
): keyof typeof providerSymbols {
  if (typeof value !== 'string') {
    throw new TwelveDataProviderError('stream event has no symbol');
  }
  const matched = Object.entries(providerSymbols).find(
    ([, providerSymbol]) => providerSymbol === value.trim().toUpperCase(),
  );
  if (matched === undefined) {
    throw new TwelveDataProviderError('stream event has an unsupported symbol');
  }
  return matched[0] as keyof typeof providerSymbols;
}

function decimalFrom(value: unknown, field: string): Decimal {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new TwelveDataProviderError(`provider response has no ${field}`);
  }
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new TwelveDataProviderError(
      `provider response has an invalid ${field}`,
    );
  }
  if (!parsed.isFinite() || !parsed.isPositive()) {
    throw new TwelveDataProviderError(
      `provider response has an invalid ${field}`,
    );
  }
  return parsed;
}

function providerTimestamp(value: unknown): Date {
  const seconds =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new TwelveDataProviderError('stream event has an invalid timestamp');
  }
  const parsed = new Date(seconds * 1_000);
  if (Number.isNaN(parsed.getTime())) {
    throw new TwelveDataProviderError('stream event has an invalid timestamp');
  }
  return parsed;
}

function candleTimestamp(value: unknown): Date {
  if (typeof value !== 'string') {
    throw new TwelveDataProviderError('historical bar has no datetime');
  }
  const normalized = value.includes('T')
    ? value
    : value.length === 10
      ? `${value}T00:00:00.000Z`
      : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new TwelveDataProviderError('historical bar has an invalid datetime');
  }
  return parsed;
}

function responseError(payload: unknown): string | null {
  if (
    !isRecord(payload) ||
    (payload.status !== 'error' && typeof payload.code !== 'number')
  ) {
    return null;
  }
  return typeof payload.message === 'string'
    ? payload.message
    : 'provider rejected the request';
}

function assertSafeInterval(initialDelayMs: number, maxDelayMs: number): void {
  if (
    !Number.isSafeInteger(initialDelayMs) ||
    !Number.isSafeInteger(maxDelayMs) ||
    initialDelayMs <= 0 ||
    maxDelayMs < initialDelayMs
  ) {
    throw new TwelveDataProviderError('reconnect timings are invalid');
  }
}

/**
 * A server-only adapter for the product owner's time-limited commercial trial.
 * Twelve Data streams a single price, not executable bid/ask. The caller must
 * supply approved full spreads so every simulated execution derives its sides
 * deterministically around that midpoint.
 */
export class TwelveDataMarketDataProvider implements MarketDataProvider {
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #fullSpreads = new Map<string, Decimal>();
  readonly #handlers = new Set<QuoteHandler>();
  readonly #latest = new Map<string, Quote>();
  readonly #now: () => Date;
  readonly #onFault: (error: TwelveDataProviderError) => void;
  readonly #quoteMaxAgeMs: number;
  readonly #reconnectInitialDelayMs: number;
  readonly #reconnectMaxDelayMs: number;
  readonly #sequence: () => bigint | Promise<bigint>;
  readonly #subscribed = new Set<keyof typeof providerSymbols>();
  readonly #trialEndsAt: Date;
  readonly #webSocketFactory: (url: string) => WebSocket;
  #connectPromise: Promise<void> | undefined;
  #heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  #lastSequence = 0n;
  #processing: Promise<void> = Promise.resolve();
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #socket: WebSocket | undefined;
  #stopped = false;

  constructor(options: TwelveDataMarketDataProviderOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new TwelveDataProviderError('API key is missing');
    }
    if (Number.isNaN(options.trialEndsAt.getTime())) {
      throw new TwelveDataProviderError('trial end timestamp is invalid');
    }
    const initialDelayMs = options.reconnectInitialDelayMs ?? 1_000;
    const maxDelayMs = options.reconnectMaxDelayMs ?? 30_000;
    assertSafeInterval(initialDelayMs, maxDelayMs);
    const quoteMaxAgeMs = options.quoteMaxAgeMs ?? 5_000;
    if (!Number.isSafeInteger(quoteMaxAgeMs) || quoteMaxAgeMs <= 0) {
      throw new TwelveDataProviderError('quote maximum age is invalid');
    }
    for (const [symbol, spread] of Object.entries(options.fullSpreads)) {
      const normalized = providerSymbolFor(symbol);
      const parsed = decimalFrom(spread, `full spread for ${normalized}`);
      this.#fullSpreads.set(normalized, parsed);
    }
    for (const symbol of twelveDataTrialSymbols) {
      if (!this.#fullSpreads.has(symbol)) {
        throw new TwelveDataProviderError(
          `full spread is missing for ${symbol}`,
        );
      }
    }
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch;
    this.#now = options.now ?? (() => new Date());
    this.#onFault = options.onFault ?? (() => undefined);
    this.#quoteMaxAgeMs = quoteMaxAgeMs;
    this.#reconnectInitialDelayMs = initialDelayMs;
    this.#reconnectMaxDelayMs = maxDelayMs;
    this.#sequence = options.sequence ?? (() => this.#lastSequence + 1n);
    this.#trialEndsAt = new Date(options.trialEndsAt);
    this.#webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url));
  }

  disconnect(): void {
    this.#stopped = true;
    if (this.#reconnectTimer !== undefined) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = undefined;
    }
    this.#socket?.close();
    this.#socket = undefined;
    this.#stopHeartbeat();
  }

  async getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]> {
    this.#assertTrialActive();
    const symbol = providerSymbolFor(input.symbol);
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 5_000
    ) {
      throw new TwelveDataProviderError(
        'historical bar limit must be from 1 to 5000',
      );
    }
    if (
      Number.isNaN(input.from.getTime()) ||
      Number.isNaN(input.to.getTime()) ||
      input.from >= input.to
    ) {
      throw new TwelveDataProviderError('historical bar range is invalid');
    }

    const request = new URL(historicalEndpoint);
    request.searchParams.set('symbol', providerSymbols[symbol]);
    request.searchParams.set('interval', providerIntervals[input.timeframe]);
    request.searchParams.set('start_date', input.from.toISOString());
    request.searchParams.set('end_date', input.to.toISOString());
    request.searchParams.set('order', 'asc');
    // Twelve Data documents that outputsize restricts a start/end range, so
    // callers split ranges to at most 5,000 bars instead of adding it here.
    request.searchParams.set('timezone', 'UTC');

    let response: Response;
    try {
      response = await this.#fetch(request, {
        headers: { Authorization: `apikey ${this.#apiKey}` },
      });
    } catch {
      throw new TwelveDataProviderError('historical request failed');
    }
    if (response.status === 429) {
      throw new TwelveDataProviderError('historical request was rate limited');
    }
    if (!response.ok) {
      throw new TwelveDataProviderError(
        `historical request returned HTTP ${response.status}`,
      );
    }
    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new TwelveDataProviderError('historical response was not JSON');
    }
    const error = responseError(payload);
    if (error !== null) {
      throw new TwelveDataProviderError(
        `historical request was rejected: ${error}`,
      );
    }
    if (!isRecord(payload) || !Array.isArray(payload.values)) {
      throw new TwelveDataProviderError('historical response has no values');
    }
    return payload.values
      .map((value): Bar => {
        if (!isRecord(value)) {
          throw new TwelveDataProviderError(
            'historical response has a malformed bar',
          );
        }
        return {
          close: decimalFrom(value.close, 'close'),
          high: decimalFrom(value.high, 'high'),
          low: decimalFrom(value.low, 'low'),
          open: decimalFrom(value.open, 'open'),
          openedAt: candleTimestamp(value.datetime),
          symbol,
        };
      })
      .filter((bar) => bar.openedAt >= input.from && bar.openedAt < input.to)
      .sort((left, right) => left.openedAt.getTime() - right.openedAt.getTime())
      .slice(0, input.limit);
  }

  async getLatestQuote(symbol: string): Promise<Quote> {
    this.#assertTrialActive();
    const normalized = providerSymbolFor(symbol);
    const quote = this.#latest.get(normalized);
    if (quote === undefined) {
      throw new TwelveDataQuoteUnavailableError(normalized);
    }
    const age = this.#now().getTime() - quote.timestamp.getTime();
    if (age < -1_000 || age > this.#quoteMaxAgeMs) {
      throw new TwelveDataQuoteUnavailableError(normalized);
    }
    return quote;
  }

  onQuote(handler: QuoteHandler): void {
    this.#handlers.add(handler);
  }

  async subscribe(symbols: string[]): Promise<void> {
    this.#assertTrialActive();
    const requested = symbols.map(providerSymbolFor);
    for (const symbol of requested) {
      this.#subscribed.add(symbol);
    }
    this.#stopped = false;
    const alreadyOpen = this.#isOpen();
    await this.#ensureConnected();
    if (alreadyOpen) {
      this.#sendSubscription(requested);
    }
  }

  #assertTrialActive(): void {
    if (this.#now().getTime() >= this.#trialEndsAt.getTime()) {
      throw new TwelveDataTrialExpiredError(this.#trialEndsAt);
    }
  }

  async #ensureConnected(): Promise<void> {
    if (this.#isOpen()) {
      return;
    }
    if (this.#connectPromise !== undefined) {
      return this.#connectPromise;
    }
    this.#connectPromise = new Promise<void>((resolve, reject) => {
      let opened = false;
      let settled = false;
      const endpoint = new URL(websocketEndpoint);
      endpoint.searchParams.set('apikey', this.#apiKey);
      const socket = this.#webSocketFactory(endpoint.toString());
      this.#socket = socket;

      const rejectInitial = (message: string) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new TwelveDataProviderError(message));
      };
      socket.once('open', () => {
        try {
          this.#assertTrialActive();
          opened = true;
          this.#reconnectAttempt = 0;
          this.#sendSubscription([...this.#subscribed]);
          this.#startHeartbeat();
          settled = true;
          resolve();
        } catch (error) {
          socket.close();
          rejectInitial(
            error instanceof Error ? error.message : 'connection rejected',
          );
        }
      });
      socket.on('message', (data) => {
        this.#processing = this.#processing
          .then(async () => this.#handleMessage(data.toString()))
          .catch((error: unknown) => {
            this.#reportFault(error);
          });
      });
      socket.on('error', () => {
        if (!opened) {
          rejectInitial('WebSocket connection failed');
        }
      });
      socket.on('close', () => {
        this.#stopHeartbeat();
        if (this.#socket === socket) {
          this.#socket = undefined;
        }
        if (!opened) {
          rejectInitial('WebSocket connection closed before opening');
        }
        this.#scheduleReconnect();
      });
    }).finally(() => {
      this.#connectPromise = undefined;
    });
    return this.#connectPromise;
  }

  async #handleMessage(raw: string): Promise<void> {
    this.#assertTrialActive();
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new TwelveDataProviderError('stream event was not JSON');
    }
    if (!isRecord(payload)) {
      throw new TwelveDataProviderError('stream event was malformed');
    }
    const providerError = responseError(payload);
    if (providerError !== null) {
      throw new TwelveDataProviderError(
        `stream event was rejected: ${providerError}`,
      );
    }
    if (payload.event !== 'price') {
      return;
    }
    const symbol = normalizedSymbolForProvider(payload.symbol);
    if (!this.#subscribed.has(symbol)) {
      throw new TwelveDataProviderError('stream event was not subscribed');
    }
    const midpoint = decimalFrom(payload.price, 'price');
    const sourceTimestamp = providerTimestamp(payload.timestamp);
    const receivedAt = this.#now();
    if (
      sourceTimestamp.getTime() > receivedAt.getTime() + 1_000 ||
      receivedAt.getTime() - sourceTimestamp.getTime() >
        providerTimestampToleranceMs
    ) {
      throw new TwelveDataProviderError(
        'stream event source timestamp is outside the allowed range',
      );
    }
    const sequence = await this.#nextSequence();
    const halfSpread = this.#fullSpreads.get(symbol)!.dividedBy(2);
    const quote: Quote = {
      ask: midpoint.plus(halfSpread),
      bid: midpoint.minus(halfSpread),
      sequence,
      symbol,
      // Twelve Data's FX stream timestamp is minute-granular. Freshness is
      // therefore based on authenticated event receipt after bounded source
      // timestamp validation, not the coarse provider timestamp itself.
      timestamp: receivedAt,
    };
    assertValidQuote(quote);
    this.#latest.set(symbol, quote);
    for (const handler of this.#handlers) {
      await handler(quote);
    }
  }

  async #nextSequence(): Promise<bigint> {
    const next = await this.#sequence();
    if (next <= this.#lastSequence || next <= 0n) {
      throw new TwelveDataProviderError('quote sequence is not monotonic');
    }
    this.#lastSequence = next;
    return next;
  }

  #isOpen(): boolean {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  #reportFault(error: unknown): void {
    this.#onFault(
      error instanceof TwelveDataProviderError
        ? error
        : new TwelveDataProviderError('stream processing failed'),
    );
  }

  #scheduleReconnect(): void {
    if (
      this.#stopped ||
      this.#subscribed.size === 0 ||
      this.#reconnectTimer !== undefined
    ) {
      return;
    }
    const delay = Math.min(
      this.#reconnectInitialDelayMs * 2 ** this.#reconnectAttempt,
      this.#reconnectMaxDelayMs,
    );
    this.#reconnectAttempt += 1;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      void this.#ensureConnected().catch((error: unknown) => {
        this.#reportFault(error);
        this.#scheduleReconnect();
      });
    }, delay);
  }

  #sendSubscription(symbols: readonly (keyof typeof providerSymbols)[]): void {
    if (symbols.length === 0 || !this.#isOpen()) {
      return;
    }
    this.#socket!.send(
      JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: symbols.map((symbol) => providerSymbols[symbol]).join(','),
        },
      }),
    );
  }

  #startHeartbeat(): void {
    this.#stopHeartbeat();
    this.#heartbeatTimer = setInterval(() => {
      if (!this.#isOpen()) {
        this.#stopHeartbeat();
        return;
      }
      this.#socket!.send(JSON.stringify({ action: 'heartbeat' }));
    }, heartbeatIntervalMs);
    this.#heartbeatTimer.unref?.();
  }

  #stopHeartbeat(): void {
    if (this.#heartbeatTimer !== undefined) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = undefined;
    }
  }
}
