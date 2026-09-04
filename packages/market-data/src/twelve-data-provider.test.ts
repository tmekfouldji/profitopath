import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

import {
  TwelveDataMarketDataProvider,
  TwelveDataTrialExpiredError,
} from './twelve-data-provider';
import type { TwelveDataProviderError } from './twelve-data-provider';

class FakeWebSocket extends EventEmitter {
  readyState: number = WebSocket.CONNECTING;
  readonly sent: string[] = [];

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.emit('open');
  }

  send(value: string): void {
    this.sent.push(value);
  }
}

function providerOptions(
  overrides: Partial<{
    fetch: typeof fetch;
    now: () => Date;
    onFault: (error: TwelveDataProviderError) => void;
    trialEndsAt: Date;
    webSocketFactory: (url: string) => WebSocket;
  }> = {},
) {
  return {
    apiKey: 'server-only-test-key',
    fullSpreads: { EURUSD: '0.00012', GBPUSD: '0.00024' },
    now: () => new Date('2026-09-01T12:00:00.000Z'),
    trialEndsAt: new Date('2026-09-14T00:00:00.000Z'),
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('TwelveDataMarketDataProvider', () => {
  it('subscribes only from the server and derives executable sides from the approved full spread', async () => {
    const socket = new FakeWebSocket();
    const received = vi.fn().mockResolvedValue(undefined);
    const provider = new TwelveDataMarketDataProvider(
      providerOptions({
        webSocketFactory: (url) => {
          expect(url).toBe(
            'wss://ws.twelvedata.com/v1/quotes/price?apikey=server-only-test-key',
          );
          return socket as unknown as WebSocket;
        },
      }),
    );
    provider.onQuote(received);

    const subscribed = provider.subscribe(['EURUSD', 'gbpusd']);
    socket.open();
    await subscribed;

    expect(JSON.parse(socket.sent[0] ?? '')).toEqual({
      action: 'subscribe',
      params: { symbols: 'EUR/USD,GBP/USD' },
    });

    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'price',
          price: '1.10000',
          symbol: 'EUR/USD',
          timestamp: 1_788_264_000,
        }),
      ),
    );
    await flush();

    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        ask: expect.objectContaining({ toString: expect.any(Function) }),
        bid: expect.objectContaining({ toString: expect.any(Function) }),
        sequence: 1n,
        symbol: 'EURUSD',
      }),
    );
    const quote = await provider.getLatestQuote('EURUSD');
    expect(quote.bid.toString()).toBe('1.09994');
    expect(quote.ask.toString()).toBe('1.10006');
  });

  it('uses an authenticated REST request for chronological historical bars without exposing the key in its URL', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          values: [
            {
              close: '1.10010',
              datetime: '2026-09-01 12:01:00',
              high: '1.10020',
              low: '1.10000',
              open: '1.10005',
            },
            {
              close: '1.10005',
              datetime: '2026-09-01 12:00:00',
              high: '1.10010',
              low: '1.09990',
              open: '1.10000',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new TwelveDataMarketDataProvider(
      providerOptions({ fetch }),
    );

    const bars = await provider.getHistoricalBars({
      from: new Date('2026-09-01T12:00:00.000Z'),
      limit: 10,
      symbol: 'EURUSD',
      timeframe: '1m',
      to: new Date('2026-09-01T12:02:00.000Z'),
    });

    const request = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(request.origin + request.pathname).toBe(
      'https://api.twelvedata.com/time_series',
    );
    expect(request.searchParams.get('apikey')).toBeNull();
    expect(request.searchParams.get('symbol')).toBe('EUR/USD');
    expect(request.searchParams.get('interval')).toBe('1min');
    expect(request.searchParams.get('outputsize')).toBeNull();
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'apikey server-only-test-key' },
    });
    expect(bars.map((bar) => bar.openedAt.toISOString())).toEqual([
      '2026-09-01T12:00:00.000Z',
      '2026-09-01T12:01:00.000Z',
    ]);
  });

  it('uses authenticated event receipt time for quote freshness when the provider timestamp is minute-granular', async () => {
    const socket = new FakeWebSocket();
    const receivedAt = new Date('2026-09-01T12:00:59.000Z');
    const provider = new TwelveDataMarketDataProvider(
      providerOptions({
        now: () => receivedAt,
        webSocketFactory: () => socket as unknown as WebSocket,
      }),
    );

    const subscribed = provider.subscribe(['EURUSD']);
    socket.open();
    await subscribed;
    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'price',
          price: '1.10000',
          symbol: 'EUR/USD',
          timestamp: 1_788_264_000,
        }),
      ),
    );
    await flush();

    expect((await provider.getLatestQuote('EURUSD')).timestamp).toEqual(
      receivedAt,
    );
  });

  it('fails closed after the trial expires and reports malformed stream data without publishing it', async () => {
    const socket = new FakeWebSocket();
    const onFault = vi.fn();
    const provider = new TwelveDataMarketDataProvider(
      providerOptions({
        now: () => new Date('2026-09-14T00:00:00.000Z'),
        onFault,
        webSocketFactory: () => socket as unknown as WebSocket,
      }),
    );

    await expect(provider.subscribe(['EURUSD'])).rejects.toBeInstanceOf(
      TwelveDataTrialExpiredError,
    );

    const activeProvider = new TwelveDataMarketDataProvider(
      providerOptions({
        onFault,
        webSocketFactory: () => socket as unknown as WebSocket,
      }),
    );
    const subscribed = activeProvider.subscribe(['EURUSD']);
    socket.open();
    await subscribed;
    socket.emit('message', Buffer.from('{'));
    await flush();

    expect(onFault).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TwelveDataProviderError' }),
    );
    await expect(activeProvider.getLatestQuote('EURUSD')).rejects.toThrow(
      'no current quote',
    );
  });
});
