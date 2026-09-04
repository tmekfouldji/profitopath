import { describe, expect, it } from 'vitest';

import { defaultTerminalProtectionPrice } from './terminal-chart';

const longPosition = {
  averageEntryPrice: '1.10020',
  id: 'position-1',
  markPrice: '1.10000',
  priceScale: 5,
  side: 'LONG' as const,
  stopLossPrice: null,
  symbol: 'EURUSD',
  takeProfitPrice: null,
};

describe('terminal protection control defaults', () => {
  it('keeps an unset long TP above entry and SL below entry', () => {
    expect(defaultTerminalProtectionPrice(longPosition, 'TAKE_PROFIT')).toBe(
      '1.10120',
    );
    expect(defaultTerminalProtectionPrice(longPosition, 'STOP_LOSS')).toBe(
      '1.09920',
    );
  });

  it('reverses the visible TP and SL sides for a short position', () => {
    const shortPosition = { ...longPosition, side: 'SHORT' as const };

    expect(defaultTerminalProtectionPrice(shortPosition, 'TAKE_PROFIT')).toBe(
      '1.09920',
    );
    expect(defaultTerminalProtectionPrice(shortPosition, 'STOP_LOSS')).toBe(
      '1.10120',
    );
  });
});
