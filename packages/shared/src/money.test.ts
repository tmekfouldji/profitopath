import { describe, expect, it } from 'vitest';

import { addMinorUnits, decimal, minorUnits, multiplyDecimal } from './money';

describe('money primitives', () => {
  it('adds integer minor units without floating-point loss', () => {
    expect(addMinorUnits(minorUnits('9007199254740993'), minorUnits(7n))).toBe(
      9_007_199_254_741_000n,
    );
  });

  it('uses decimal arithmetic for trading values', () => {
    expect(multiplyDecimal('0.1', '0.2').equals(decimal('0.02'))).toBe(true);
  });
});
