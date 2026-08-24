import { describe, expect, it } from 'vitest';

import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
} from './terminal-chart-studies';

const candles = [
  { close: 1, time: 1 },
  { close: 2, time: 2 },
  { close: 3, time: 3 },
  { close: 4, time: 4 },
];

describe('terminal chart studies', () => {
  it('starts a simple moving average after its complete trailing window', () => {
    expect(simpleMovingAverage(candles, 3)).toEqual([
      { close: 2, time: 3 },
      { close: 3, time: 4 },
    ]);
  });

  it('seeds and advances an exponential moving average deterministically', () => {
    expect(exponentialMovingAverage(candles, 3)).toEqual([
      { close: 2, time: 3 },
      { close: 3, time: 4 },
    ]);
  });

  it('returns symmetric Bollinger bands around the trailing mean', () => {
    const band = bollingerBands(candles, 3, 2)[0];

    expect(band?.middle).toBe(2);
    expect(band?.upper).toBeCloseTo(3.632993, 5);
    expect(band?.lower).toBeCloseTo(0.367007, 5);
  });
});
