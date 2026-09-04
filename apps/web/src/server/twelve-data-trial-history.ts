import 'server-only';

import type {
  CandleRangeRequest,
  MarketCandle,
  MarketCandleService,
} from '@profitopath/market-data';
import { parseRuntimeEnv } from '@profitopath/shared';

export class TwelveDataTrialHistoryUnavailableError extends Error {
  constructor() {
    super('Twelve Data trial historical backfill is unavailable');
    this.name = 'TwelveDataTrialHistoryUnavailableError';
  }
}

class TwelveDataWorkerHistoryClient {
  async backfill(input: CandleRangeRequest): Promise<void> {
    const env = parseRuntimeEnv();
    if (env.MARKET_DATA_SOURCE !== 'twelve-data-trial') {
      return;
    }
    const minimumFrom = new Date(
      input.to.getTime() - env.TWELVE_DATA_TRIAL_HISTORY_MAX_MINUTES * 60_000,
    );
    const from =
      input.from.getTime() > minimumFrom.getTime() ? input.from : minimumFrom;
    const response = await fetch(
      new URL(
        '/internal/market-data/twelve-data-trial/backfill',
        env.MARKET_DATA_WORKER_INTERNAL_URL,
      ),
      {
        body: JSON.stringify({
          from: from.toISOString(),
          symbol: input.symbol,
          to: input.to.toISOString(),
        }),
        headers: {
          Authorization: `Bearer ${env.MARKET_DATA_INTERNAL_TOKEN}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      throw new TwelveDataTrialHistoryUnavailableError();
    }
  }
}

/**
 * The web process owns no provider key. It first asks the worker to ensure
 * durable source-isolated coverage, but returns already persisted candles if
 * the upstream source or worker is temporarily unavailable.
 */
export class WorkerBackfilledCandleService {
  readonly #candles: MarketCandleService;
  readonly #worker: TwelveDataWorkerHistoryClient;

  constructor(
    candles: MarketCandleService,
    worker: TwelveDataWorkerHistoryClient = new TwelveDataWorkerHistoryClient(),
  ) {
    this.#candles = candles;
    this.#worker = worker;
  }

  async getCandles(input: CandleRangeRequest): Promise<MarketCandle[]> {
    const existing = await this.#candles.getCandles(input);
    // Chart interaction must prefer the durable, source-isolated history we
    // already have. A worker refresh is still useful, but it must not hold a
    // timeframe switch hostage while it checks or extends coverage.
    if (existing.length > 0) {
      void this.#worker.backfill(input).catch(() => undefined);
      return existing;
    }
    try {
      await this.#worker.backfill(input);
    } catch {
      return existing;
    }
    return this.#candles.getCandles(input);
  }
}
