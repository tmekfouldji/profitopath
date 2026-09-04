import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import { TwelveDataTrialRuntime } from './twelve-data-trial-runtime';

class FakeProvider {
  readonly disconnect = vi.fn();
  readonly subscribe = vi.fn().mockResolvedValue(undefined);
  #handler:
    | ((quote: {
        ask: Decimal;
        bid: Decimal;
        sequence: bigint;
        symbol: string;
        timestamp: Date;
      }) => Promise<void>)
    | undefined;

  onQuote(
    handler: (quote: {
      ask: Decimal;
      bid: Decimal;
      sequence: bigint;
      symbol: string;
      timestamp: Date;
    }) => Promise<void>,
  ): void {
    this.#handler = handler;
  }

  async publish(): Promise<void> {
    await this.#handler?.({
      ask: new Decimal('1.10006'),
      bid: new Decimal('1.09994'),
      sequence: 1n,
      symbol: 'EURUSD',
      timestamp: new Date(),
    });
  }
}

describe('TwelveDataTrialRuntime', () => {
  it('elects one worker, recovers before subscribing, and processes only server-owned quote events', async () => {
    const events: string[] = [];
    const provider = new FakeProvider();
    provider.subscribe.mockImplementation(async () => {
      events.push('subscribe');
    });
    const leaseClient = {
      eval: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
    };
    const runtime = new TwelveDataTrialRuntime({
      accountStatePublisher: {
        publish: vi.fn(async () => {
          events.push('account-state');
        }),
      },
      backfill: vi.fn(async () => {
        events.push('backfill');
      }),
      candleProcessor: {
        process: vi.fn(async () => {
          events.push('candle');
        }),
      },
      leaseClient,
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      processor: {
        processQuote: vi.fn(async () => {
          events.push('risk');
        }),
      },
      provider,
      quotePublisher: {
        publish: vi.fn(async () => {
          events.push('quote');
        }),
      },
      recover: vi.fn(async () => {
        events.push('recover');
        return { accounts: [{ id: 'account-1' }] };
      }),
      symbols: ['GBPUSD', 'EURUSD', 'EURUSD'],
      trialEndsAt: new Date('2099-09-14T00:00:00.000Z'),
      verifyInstrumentConfiguration: vi.fn().mockResolvedValue(undefined),
    });

    await runtime.start();

    expect(events).toEqual(['recover', 'backfill', 'subscribe']);
    expect(provider.subscribe).toHaveBeenCalledWith(['EURUSD', 'GBPUSD']);
    await provider.publish();
    expect(events).toContain('quote');

    await runtime.stop();
    expect(events).toEqual([
      'recover',
      'backfill',
      'subscribe',
      'quote',
      'candle',
      'risk',
      'account-state',
    ]);
    expect(provider.disconnect).toHaveBeenCalledOnce();
  });

  it('does not create an upstream stream when another worker holds the distributed lease', async () => {
    const provider = new FakeProvider();
    const runtime = new TwelveDataTrialRuntime({
      candleProcessor: { process: vi.fn() },
      leaseClient: {
        eval: vi.fn(),
        set: vi.fn().mockResolvedValue(null),
      },
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      processor: { processQuote: vi.fn() },
      provider,
      quotePublisher: { publish: vi.fn() },
      recover: vi.fn(async () => ({ accounts: [] })),
      symbols: ['EURUSD', 'GBPUSD'],
      trialEndsAt: new Date('2099-09-14T00:00:00.000Z'),
      verifyInstrumentConfiguration: vi.fn().mockResolvedValue(undefined),
    });

    await runtime.start();

    expect(provider.subscribe).not.toHaveBeenCalled();
    await runtime.stop();
  });
});
