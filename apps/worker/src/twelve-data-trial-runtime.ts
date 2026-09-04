import type { Quote } from '@profitopath/market-data';

export interface TwelveDataTrialLeaseClient {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    expiryMilliseconds: number,
    condition: 'NX',
  ): Promise<'OK' | null>;
}

export interface TwelveDataTrialProvider {
  disconnect(): void;
  onQuote(handler: (quote: Quote) => Promise<void>): void;
  subscribe(symbols: string[]): Promise<void>;
}

export interface TwelveDataTrialRuntimeLogger {
  error(context: object, message: string): void;
  info(context: object, message: string): void;
  warn(context: object, message: string): void;
}

const renewLeaseScript = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
  end
  return 0
`;

const releaseLeaseScript = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;

function resultIsOne(value: unknown): boolean {
  return value === 1 || value === '1';
}

/**
 * Ensures horizontally replicated workers still create one provider stream.
 * The quote cache stays rebuildable: loss of the lease only causes one worker
 * to acquire a new stream and repopulate Valkey from fresh provider events.
 */
export class TwelveDataTrialRuntime {
  readonly #candleProcessor: { process(quote: Quote): Promise<unknown> };
  readonly #backfill: () => Promise<unknown>;
  readonly #leaseClient: TwelveDataTrialLeaseClient;
  readonly #leaseKey = 'market:lease:v1:twelve-data-trial';
  readonly #leaseMilliseconds = 15_000;
  readonly #logger: TwelveDataTrialRuntimeLogger;
  readonly #processor: { processQuote(quote: Quote): Promise<unknown> };
  readonly #provider: TwelveDataTrialProvider;
  readonly #quotePublisher: { publish(quote: Quote): Promise<void> };
  readonly #recover: () => Promise<{ accounts: unknown[] }>;
  readonly #symbols: string[];
  readonly #tickMilliseconds = 5_000;
  readonly #token = crypto.randomUUID();
  readonly #trialEndsAt: Date;
  readonly #verifyInstrumentConfiguration: () => Promise<void>;
  #leader = false;
  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(input: {
    backfill?: () => Promise<unknown>;
    candleProcessor: { process(quote: Quote): Promise<unknown> };
    leaseClient: TwelveDataTrialLeaseClient;
    logger: TwelveDataTrialRuntimeLogger;
    processor: { processQuote(quote: Quote): Promise<unknown> };
    provider: TwelveDataTrialProvider;
    quotePublisher: { publish(quote: Quote): Promise<void> };
    recover: () => Promise<{ accounts: unknown[] }>;
    symbols: string[];
    trialEndsAt: Date;
    verifyInstrumentConfiguration: () => Promise<void>;
  }) {
    if (Number.isNaN(input.trialEndsAt.getTime())) {
      throw new Error('Twelve Data trial end timestamp is invalid');
    }
    this.#candleProcessor = input.candleProcessor;
    this.#backfill = input.backfill ?? (() => Promise.resolve());
    this.#leaseClient = input.leaseClient;
    this.#logger = input.logger;
    this.#processor = input.processor;
    this.#provider = input.provider;
    this.#quotePublisher = input.quotePublisher;
    this.#recover = input.recover;
    this.#symbols = [...new Set(input.symbols)].sort();
    this.#trialEndsAt = new Date(input.trialEndsAt);
    this.#verifyInstrumentConfiguration = input.verifyInstrumentConfiguration;
  }

  async start(): Promise<void> {
    if (this.#running) {
      return;
    }
    this.#running = true;
    this.#provider.onQuote(async (quote) => {
      await this.#quotePublisher.publish(quote);
      await this.#candleProcessor.process(quote);
      await this.#processor.processQuote(quote);
    });
    await this.#tick();
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    this.#provider.disconnect();
    if (this.#leader) {
      try {
        await this.#leaseClient.eval(
          releaseLeaseScript,
          1,
          this.#leaseKey,
          this.#token,
        );
      } catch (error: unknown) {
        this.#logger.warn(
          { error },
          'Twelve Data trial lease release failed; it will expire automatically',
        );
      }
    }
    this.#leader = false;
  }

  async #tick(): Promise<void> {
    if (!this.#running) {
      return;
    }
    if (Date.now() >= this.#trialEndsAt.getTime()) {
      this.#logger.warn(
        { endsAt: this.#trialEndsAt.toISOString() },
        'Twelve Data trial expired; provider feed stopped',
      );
      await this.stop();
      return;
    }
    try {
      if (this.#leader) {
        const renewed = resultIsOne(
          await this.#leaseClient.eval(
            renewLeaseScript,
            1,
            this.#leaseKey,
            this.#token,
            String(this.#leaseMilliseconds),
          ),
        );
        if (!renewed) {
          this.#leader = false;
          this.#provider.disconnect();
          this.#logger.warn(
            {},
            'Twelve Data trial feed lease was lost; awaiting another election',
          );
        }
      }
      if (!this.#leader) {
        const acquired = await this.#leaseClient.set(
          this.#leaseKey,
          this.#token,
          'PX',
          this.#leaseMilliseconds,
          'NX',
        );
        if (acquired === 'OK') {
          try {
            await this.#verifyInstrumentConfiguration();
            const recovery = await this.#recover();
            await this.#backfill();
            await this.#provider.subscribe(this.#symbols);
            this.#leader = true;
            this.#logger.info(
              {
                recoveredAccounts: recovery.accounts.length,
                symbols: this.#symbols,
              },
              'Twelve Data trial feed lease acquired',
            );
          } catch (error) {
            await this.#leaseClient.eval(
              releaseLeaseScript,
              1,
              this.#leaseKey,
              this.#token,
            );
            throw error;
          }
        }
      }
    } catch (error: unknown) {
      this.#logger.error(
        { error },
        'Twelve Data trial feed cycle failed and will retry',
      );
    } finally {
      if (this.#running) {
        this.#timer = setTimeout(
          () => void this.#tick(),
          this.#tickMilliseconds,
        );
      }
    }
  }
}
