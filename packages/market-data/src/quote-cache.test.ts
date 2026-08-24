import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  CachedMarketDataProvider,
  type QuoteCacheClient,
  ValkeyQuoteStore,
} from './quote-cache';

class MemoryQuoteCache implements QuoteCacheClient {
  readonly messages: string[] = [];
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    _expiryMode: 'EX',
    _expirySeconds: number,
  ): Promise<void> {
    this.values.set(key, value);
  }

  async publish(_channel: string, message: string): Promise<void> {
    this.messages.push(message);
  }
}

describe('shared quote cache', () => {
  it('round-trips exact normalized quotes through rebuildable cache state', async () => {
    const cache = new MemoryQuoteCache();
    const timestamp = new Date('2026-08-24T09:00:00.000Z');
    const store = new ValkeyQuoteStore(cache, 30, () => timestamp);
    await store.publish({
      ask: new Decimal('1.10020'),
      bid: new Decimal('1.10000'),
      sequence: 42n,
      symbol: 'eurusd',
      timestamp,
    });

    await expect(store.get('EURUSD')).resolves.toEqual({
      ask: new Decimal('1.10020'),
      bid: new Decimal('1.10000'),
      sequence: 42n,
      symbol: 'EURUSD',
      timestamp,
    });
    expect(cache.messages).toHaveLength(1);
  });

  it('fails closed when the shared quote is absent', async () => {
    const provider = new CachedMarketDataProvider(
      new ValkeyQuoteStore(new MemoryQuoteCache()),
    );
    await expect(provider.getLatestQuote('EURUSD')).rejects.toThrow(
      'Cached quote is unavailable',
    );
  });

  it('fails closed when cached data has outlived its accepted age', async () => {
    const cache = new MemoryQuoteCache();
    const store = new ValkeyQuoteStore(
      cache,
      30,
      () => new Date('2026-08-24T09:00:31.000Z'),
    );
    await store.publish({
      ask: new Decimal('1.10020'),
      bid: new Decimal('1.10000'),
      sequence: 42n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:00.000Z'),
    });

    await expect(store.get('EURUSD')).rejects.toThrow(
      'Cached quote is unavailable',
    );
  });
});
