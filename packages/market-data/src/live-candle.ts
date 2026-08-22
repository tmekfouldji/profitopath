import type { Quote } from './types';
import {
  type CandleRepository,
  type MarketCandle,
  PrismaCandleRepository,
  QuoteCandleBuilder,
} from './candle-service';
import { normalizeSymbol } from './quote-validator';

export interface CandleEventPublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export interface LiveCandleResult {
  current: MarketCandle;
  finalized: MarketCandle | null;
}

function candlePayload(candle: MarketCandle): string {
  return JSON.stringify({
    close: candle.close.toString(),
    closeTime: candle.closeTime.toISOString(),
    high: candle.high.toString(),
    isFinal: candle.isFinal,
    low: candle.low.toString(),
    open: candle.open.toString(),
    openTime: candle.openTime.toISOString(),
    source: candle.source,
    symbol: candle.symbol,
    timeframe: candle.timeframe,
  });
}

export class LiveCandleProcessor {
  readonly #builders = new Map<string, QuoteCandleBuilder>();
  readonly #publisher: CandleEventPublisher;
  readonly #repository: CandleRepository;

  constructor(
    publisher: CandleEventPublisher,
    repository: CandleRepository = new PrismaCandleRepository(),
  ) {
    this.#publisher = publisher;
    this.#repository = repository;
  }

  async process(quote: Quote): Promise<LiveCandleResult> {
    const symbol = normalizeSymbol(quote.symbol);
    const builder = this.#builders.get(symbol) ?? new QuoteCandleBuilder();
    this.#builders.set(symbol, builder);
    const update = builder.update({ ...quote, symbol });
    if (update.finalized !== null) {
      await this.#repository.insertMissing([update.finalized]);
      await this.#publisher.publish(
        'market:candles:v1',
        candlePayload(update.finalized),
      );
    }
    await this.#publisher.publish(
      'market:candles:v1',
      candlePayload(update.current),
    );
    return update;
  }
}
