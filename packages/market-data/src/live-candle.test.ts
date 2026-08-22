import Decimal from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';

import type { CandleRepository } from './candle-service';
import { LiveCandleProcessor } from './live-candle';

describe('live candle processor', () => {
  it('publishes forming candles and persists a finalized server bucket', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const insertMissing = vi.fn().mockResolvedValue(undefined);
    const repository: CandleRepository = {
      findFinalRange: vi.fn(),
      insertMissing,
    };
    const processor = new LiveCandleProcessor({ publish }, repository);
    await processor.process({
      ask: new Decimal('1.10020'),
      bid: new Decimal('1.10000'),
      sequence: 1n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:10.000Z'),
    });
    const next = await processor.process({
      ask: new Decimal('1.10030'),
      bid: new Decimal('1.10010'),
      sequence: 2n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:01:00.000Z'),
    });

    expect(next.finalized?.isFinal).toBe(true);
    expect(insertMissing).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish.mock.calls[0]?.[0]).toBe('market:candles:v1');
  });
});
