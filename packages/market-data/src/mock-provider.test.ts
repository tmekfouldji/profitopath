import { describe, expect, it, vi } from 'vitest';

import {
  MockHistoricalDataUnavailableError,
  MockMarketDataProvider,
  MockQuoteUnavailableError,
} from './mock-provider';

const seeds = [
  {
    ask: '1.10020',
    bid: '1.10000',
    symbol: 'eurusd',
    timestamp: new Date('2026-08-24T09:00:00.000Z'),
  },
  {
    ask: '1.10030',
    bid: '1.10010',
    symbol: 'EURUSD',
    timestamp: new Date('2026-08-24T09:00:01.000Z'),
  },
] as const;

describe('MockMarketDataProvider', () => {
  it('replays seeded quotes deterministically for subscribed symbols', async () => {
    const provider = new MockMarketDataProvider(seeds);
    const handler = vi.fn();
    provider.onQuote(handler);
    await provider.subscribe(['eurusd']);

    const first = await provider.publishNext();
    const second = await provider.publishNext();

    expect(first?.sequence).toBe(1n);
    expect(second?.sequence).toBe(2n);
    expect(handler).toHaveBeenCalledTimes(2);
    await expect(provider.getLatestQuote('EURUSD')).resolves.toMatchObject({
      sequence: 2n,
      symbol: 'EURUSD',
    });
  });

  it('resets to the same quote sequence', async () => {
    const provider = new MockMarketDataProvider(seeds);
    await provider.subscribe(['EURUSD']);
    const first = await provider.publishNext();
    provider.reset();
    const replayed = await provider.publishNext();

    expect(replayed).toEqual(first);
  });

  it('rejects subscriptions and lookups without available data', async () => {
    const provider = new MockMarketDataProvider(seeds);

    await expect(provider.subscribe(['GBPUSD'])).rejects.toBeInstanceOf(
      MockQuoteUnavailableError,
    );
    await expect(provider.getLatestQuote('EURUSD')).rejects.toBeInstanceOf(
      MockQuoteUnavailableError,
    );
  });

  it('keeps historical retrieval explicit until the candle phase', async () => {
    const provider = new MockMarketDataProvider(seeds);

    await expect(
      provider.getHistoricalBars({
        from: new Date('2026-08-24T00:00:00.000Z'),
        limit: 500,
        symbol: 'EURUSD',
        timeframe: '1m',
        to: new Date('2026-08-24T09:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(MockHistoricalDataUnavailableError);
  });
});
