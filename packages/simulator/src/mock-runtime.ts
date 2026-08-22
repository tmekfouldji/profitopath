import type {
  MarketDataProvider,
  MockQuoteSeed,
  Quote,
} from '@profitopath/market-data';

import type { MarkToMarketResult, SimulatorRecoveryState } from './engine';

export interface DeterministicQuotePublisher extends MarketDataProvider {
  publishNext(): Promise<Quote | null>;
}

export interface QuoteRiskProcessor {
  markToMarket(quote: Quote): Promise<MarkToMarketResult>;
}

export interface MockRuntimeResult {
  processedQuotes: number;
  recovery: SimulatorRecoveryState;
}

export function createDevelopmentMockQuoteSeeds(
  reference: Date,
): readonly MockQuoteSeed[] {
  const base = Math.floor(reference.getTime() / 1_000) * 1_000;
  return [
    {
      ask: '1.10020',
      bid: '1.10000',
      symbol: 'EURUSD',
      timestamp: new Date(base),
    },
    {
      ask: '1.27030',
      bid: '1.27000',
      symbol: 'GBPUSD',
      timestamp: new Date(base),
    },
    {
      ask: '1.10030',
      bid: '1.10010',
      symbol: 'EURUSD',
      timestamp: new Date(base + 1_000),
    },
    {
      ask: '1.27020',
      bid: '1.26990',
      symbol: 'GBPUSD',
      timestamp: new Date(base + 1_000),
    },
  ] as const;
}

export class MockSimulatorRuntime {
  readonly #processor: QuoteRiskProcessor;
  readonly #provider: DeterministicQuotePublisher;
  readonly #recover: () => Promise<SimulatorRecoveryState>;

  constructor(input: {
    processor: QuoteRiskProcessor;
    provider: DeterministicQuotePublisher;
    recover: () => Promise<SimulatorRecoveryState>;
  }) {
    this.#processor = input.processor;
    this.#provider = input.provider;
    this.#recover = input.recover;
  }

  async run(symbols: string[]): Promise<MockRuntimeResult> {
    const recovery = await this.#recover();
    await this.#provider.subscribe(symbols);
    this.#provider.onQuote(async (quote) => {
      await this.#processor.markToMarket(quote);
    });
    let processedQuotes = 0;
    while ((await this.#provider.publishNext()) !== null) {
      processedQuotes += 1;
    }
    return { processedQuotes, recovery };
  }
}
