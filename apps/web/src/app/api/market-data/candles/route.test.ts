import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findAccount: vi.fn(),
  findInstrument: vi.fn(),
  getCandles: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@profitopath/database', () => ({
  database: {
    instrumentConfiguration: { findFirst: mocks.findInstrument },
    tradingAccount: { findFirst: mocks.findAccount },
  },
}));
vi.mock('@/server/auth/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/terminal', () => ({
  terminalCandleService: { getCandles: mocks.getCandles },
}));

import { GET } from './route';

function request(query: string): Request {
  return new Request(`http://localhost/api/market-data/candles?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: 'user-1', status: 'ACTIVE' },
  });
  mocks.findAccount.mockResolvedValue({ id: 'account-1' });
  mocks.findInstrument.mockResolvedValue({ symbol: 'EURUSD' });
});

describe('candle API ownership and serialization', () => {
  it('rejects an unauthenticated range before querying storage', async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await GET(request('symbol=EURUSD&timeframe=1m'));

    expect(response.status).toBe(401);
    expect(mocks.findAccount).not.toHaveBeenCalled();
  });

  it('rejects unsupported timeframes before account lookup', async () => {
    const response = await GET(request('symbol=EURUSD&timeframe=30m'));

    expect(response.status).toBe(400);
    expect(mocks.findAccount).not.toHaveBeenCalled();
  });

  it('returns exact backend candles only after owner and instrument checks', async () => {
    mocks.getCandles.mockResolvedValue([
      {
        close: new Decimal('1.10020'),
        closeTime: new Date('2026-08-24T09:01:00.000Z'),
        high: new Decimal('1.10030'),
        isFinal: true,
        low: new Decimal('1.09990'),
        open: new Decimal('1.10000'),
        openTime: new Date('2026-08-24T09:00:00.000Z'),
        source: 'MOCK_SEED',
      },
    ]);
    const response = await GET(
      request(
        'accountId=account-1&symbol=eurusd&timeframe=1m&limit=500&from=2026-08-24T09%3A00%3A00Z&to=2026-08-24T10%3A00%3A00Z',
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      candles: [
        {
          close: '1.1002',
          isFinal: true,
          openTime: '2026-08-24T09:00:00.000Z',
          source: 'MOCK_SEED',
        },
      ],
      symbol: 'EURUSD',
      timeframe: '1m',
    });
    expect(mocks.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 500,
        symbol: 'EURUSD',
        timeframe: '1m',
      }),
    );
  });
});
