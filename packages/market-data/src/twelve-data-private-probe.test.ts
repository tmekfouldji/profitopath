import { describe, expect, it, vi } from 'vitest';

import {
  TwelveDataPrivateProbe,
  TwelveDataPrivateProbeError,
} from './twelve-data-private-probe';

describe('TwelveDataPrivateProbe', () => {
  it('uses the documented batched price request and retains a server timestamp', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          'EUR/USD': { price: '1.17456' },
          'GBP/USD': { price: '1.35678' },
        }),
        { status: 200 },
      ),
    );
    const receivedAt = new Date('2026-08-31T10:00:00.000Z');
    const probe = new TwelveDataPrivateProbe({
      apiKey: 'private-test-key',
      fetch,
      now: () => receivedAt,
    });
    await probe.subscribe(['gbpusd', 'EURUSD']);

    const samples = await probe.sample();

    expect(
      samples.map((sample) => ({
        midpoint: sample.midpoint.toString(),
        receivedAt: sample.receivedAt,
        symbol: sample.symbol,
      })),
    ).toEqual([
      { midpoint: '1.17456', receivedAt, symbol: 'EURUSD' },
      { midpoint: '1.35678', receivedAt, symbol: 'GBPUSD' },
    ]);
    const request = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(request.origin + request.pathname).toBe(
      'https://api.twelvedata.com/price',
    );
    expect(request.searchParams.get('symbol')).toBe('EUR/USD,GBP/USD');
    expect(request.searchParams.get('apikey')).toBe('private-test-key');
  });

  it('supports the documented single-symbol price response', async () => {
    const probe = new TwelveDataPrivateProbe({
      apiKey: 'private-test-key',
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ price: '1.17456' }), { status: 200 }),
        ),
    });
    await probe.subscribe(['EURUSD']);

    const samples = await probe.sample();

    expect(samples[0]?.midpoint.toString()).toBe('1.17456');
  });

  it('does not make a request before a supported symbol is selected', async () => {
    const fetch = vi.fn();
    const probe = new TwelveDataPrivateProbe({
      apiKey: 'private-test-key',
      fetch,
    });

    await expect(probe.sample()).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported symbols and unsafe provider responses', async () => {
    const probe = new TwelveDataPrivateProbe({
      apiKey: 'private-test-key',
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 'error' }), { status: 200 }),
        ),
    });

    await expect(probe.subscribe(['USDJPY'])).rejects.toBeInstanceOf(
      TwelveDataPrivateProbeError,
    );
    await probe.subscribe(['EURUSD']);
    await expect(probe.sample()).rejects.toBeInstanceOf(
      TwelveDataPrivateProbeError,
    );
  });
});
