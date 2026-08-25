import { describe, expect, it } from 'vitest';

import {
  constrainTrendLinePoint,
  snapChartPointToCandleOhlc,
} from './terminal-chart-constraints';

const start = { price: 1.1, time: 100, x: 40, y: 60 };

describe('terminal chart constraints', () => {
  it('locks a Shift-held trend line to the dominant horizontal or vertical axis', () => {
    expect(
      constrainTrendLinePoint({
        current: { price: 1.106, time: 160, x: 150, y: 90 },
        shiftKey: true,
        start,
      }),
    ).toEqual({ price: 1.1, time: 160, x: 150, y: 60 });
    expect(
      constrainTrendLinePoint({
        current: { price: 1.106, time: 160, x: 80, y: 190 },
        shiftKey: true,
        start,
      }),
    ).toEqual({ price: 1.106, time: 100, x: 40, y: 190 });
  });

  it('snaps a Control-held point to the closest OHLC value on its candle', () => {
    expect(
      snapChartPointToCandleOhlc({
        candles: [
          {
            close: 1.102,
            high: 1.104,
            low: 1.098,
            open: 1.1,
            time: 100,
          },
        ],
        point: { price: 1.1031, time: 100, x: 80, y: 120 },
      }),
    ).toEqual({ price: 1.104, time: 100, x: 80, y: 120 });
  });

  it('does not invent an OHLC snap where there is no candle', () => {
    const point = { price: 1.106, time: 160, x: 100, y: 90 };

    expect(
      snapChartPointToCandleOhlc({
        candles: [
          {
            close: 1.102,
            high: 1.104,
            low: 1.098,
            open: 1.1,
            time: 100,
          },
        ],
        point,
      }),
    ).toBe(point);
  });
});
