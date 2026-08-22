import { describe, expect, it } from 'vitest';

import {
  addMinorUnits,
  decimal,
  formatUsdMinor,
  minorUnits,
  multiplyDecimal,
} from './money';

describe('money primitives', () => {
  it('adds integer minor units without floating-point loss', () => {
    expect(addMinorUnits(minorUnits('9007199254740993'), minorUnits(7n))).toBe(
      9_007_199_254_741_000n,
    );
  });

  it('uses decimal arithmetic for trading values', () => {
    expect(multiplyDecimal('0.1', '0.2').equals(decimal('0.02'))).toBe(true);
  });

  it('formats minor units without converting through floating point', () => {
    expect(formatUsdMinor(9_007_199_254_740_993n)).toBe(
      '$90,071,992,547,409.93',
    );
    expect(formatUsdMinor(-505n)).toBe('-$5.05');
  });
});
