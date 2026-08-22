import { describe, expect, it } from 'vitest';

import { parseCandleDelta, parseQuoteDelta } from './protocol';

describe('realtime protocol', () => {
  it('normalizes a typed quote delta and rejects malformed messages', () => {
    expect(
      parseQuoteDelta(
        JSON.stringify({
          ask: '1.1002',
          bid: '1.1',
          sequence: '7',
          symbol: 'eurusd',
          timestamp: '2026-08-24T09:00:00.000Z',
        }),
      ),
    ).toEqual({
      ask: '1.1002',
      bid: '1.1',
      kind: 'quote',
      sequence: '7',
      symbol: 'EURUSD',
      timestamp: '2026-08-24T09:00:00.000Z',
    });
    expect(parseQuoteDelta('{')).toBeNull();
    expect(parseQuoteDelta('{}')).toBeNull();
  });

  it('normalizes server-built candle deltas', () => {
    expect(
      parseCandleDelta(
        JSON.stringify({
          close: '1.1002',
          closeTime: '2026-08-24T09:01:00.000Z',
          high: '1.1003',
          isFinal: false,
          low: '1.1',
          open: '1.1001',
          openTime: '2026-08-24T09:00:00.000Z',
          source: 'MOCK_LIVE',
          symbol: 'eurusd',
          timeframe: '1m',
        }),
      ),
    ).toMatchObject({ kind: 'candle', symbol: 'EURUSD', timeframe: '1m' });
  });
});
