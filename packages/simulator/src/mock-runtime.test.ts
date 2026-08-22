import { MockMarketDataProvider } from '@profitopath/market-data';
import { describe, expect, it, vi } from 'vitest';

import {
  createDevelopmentMockQuoteSeeds,
  MockSimulatorRuntime,
} from './mock-runtime';

describe('MockSimulatorRuntime', () => {
  it('recovers before draining a deterministic server-owned quote cycle', async () => {
    const seeds = createDevelopmentMockQuoteSeeds(
      new Date('2026-08-24T09:00:00.987Z'),
    );
    const provider = new MockMarketDataProvider(seeds);
    const processQuote = vi.fn().mockResolvedValue({
      breachedAccounts: 0,
      cancelledProtectionOrders: 0,
      duplicateAccounts: 0,
      expiredOrders: 0,
      filledOrders: 0,
      snapshottedAccounts: 0,
    });
    const recover = vi.fn().mockResolvedValue({
      accounts: [],
      recoveredAt: new Date('2026-08-24T09:00:00.000Z'),
    });
    const publish = vi.fn().mockResolvedValue(undefined);
    const runtime = new MockSimulatorRuntime({
      processor: { processQuote },
      provider,
      quotePublisher: { publish },
      recover,
    });

    const result = await runtime.run(['EURUSD', 'GBPUSD']);

    expect(recover).toHaveBeenCalledOnce();
    expect(result.processedQuotes).toBe(4);
    expect(processQuote).toHaveBeenCalledTimes(4);
    expect(publish).toHaveBeenCalledTimes(4);
    expect(seeds[0]?.timestamp.toISOString()).toBe('2026-08-24T09:00:00.000Z');
    expect(seeds[3]?.sequence).toBe(4n);
  });

  it('can continue a monotonic quote sequence across worker cycles', () => {
    const seeds = createDevelopmentMockQuoteSeeds(
      new Date('2026-08-24T09:00:05.000Z'),
      5n,
    );

    expect(seeds.map((seed) => seed.sequence)).toEqual([5n, 6n, 7n, 8n]);
  });
});
