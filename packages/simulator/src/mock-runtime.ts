import type {
  MarketDataProvider,
  MockQuoteSeed,
  Quote,
} from '@profitopath/market-data';

import type { ProcessQuoteResult, SimulatorRecoveryState } from './engine';

export interface DeterministicQuotePublisher extends MarketDataProvider {
  publishNext(): Promise<Quote | null>;
}

export interface QuoteRiskProcessor {
  processQuote(quote: Quote): Promise<ProcessQuoteResult>;
}

export interface RuntimeQuotePublisher {
  publish(quote: Quote): Promise<void>;
}

export interface MockRuntimeResult {
  processedQuotes: number;
  recovery: SimulatorRecoveryState;
}

export function createDevelopmentMockQuoteSeeds(
  reference: Date,
  firstSequence = 1n,
): readonly MockQuoteSeed[] {
  const base = Math.floor(reference.getTime() / 1_000) * 1_000;
  return [
    {
      ask: '1.10020',
      bid: '1.10000',
      sequence: firstSequence,
      symbol: 'EURUSD',
      timestamp: new Date(base),
    },
    {
      ask: '1.27030',
      bid: '1.27000',
      sequence: firstSequence + 1n,
      symbol: 'GBPUSD',
      timestamp: new Date(base),
    },
    {
      ask: '1.10030',
      bid: '1.10010',
      sequence: firstSequence + 2n,
      symbol: 'EURUSD',
      timestamp: new Date(base + 1_000),
    },
    {
      ask: '1.27020',
      bid: '1.26990',
      sequence: firstSequence + 3n,
      symbol: 'GBPUSD',
      timestamp: new Date(base + 1_000),
    },
  ] as const;
}

export class MockSimulatorRuntime {
  readonly #processor: QuoteRiskProcessor;
  readonly #provider: DeterministicQuotePublisher;
  readonly #quotePublisher: RuntimeQuotePublisher | null;
  readonly #recover: () => Promise<SimulatorRecoveryState>;

  constructor(input: {
    processor: QuoteRiskProcessor;
    provider: DeterministicQuotePublisher;
    quotePublisher?: RuntimeQuotePublisher;
    recover: () => Promise<SimulatorRecoveryState>;
  }) {
    this.#processor = input.processor;
    this.#provider = input.provider;
    this.#quotePublisher = input.quotePublisher ?? null;
    this.#recover = input.recover;
  }

  async run(symbols: string[]): Promise<MockRuntimeResult> {
    const recovery = await this.#recover();
    await this.#provider.subscribe(symbols);
    this.#provider.onQuote(async (quote) => {
      await this.#quotePublisher?.publish(quote);
      await this.#processor.processQuote(quote);
    });
    let processedQuotes = 0;
    while ((await this.#provider.publishNext()) !== null) {
      processedQuotes += 1;
    }
    return { processedQuotes, recovery };
  }
}
