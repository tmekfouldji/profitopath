import { describe, expect, it } from 'vitest';

import {
  parseTerminalChartDrawings,
  positionPlanStats,
  replaceTerminalChartDrawingPoint,
  translateTerminalChartDrawing,
  type TerminalChartDrawing,
} from './terminal-chart-drawings';

const longPlan: TerminalChartDrawing = {
  first: { price: 1.1, time: 1_000 },
  id: 'long-plan',
  kind: 'LONG_POSITION',
  second: { price: 1.104, time: 1_100 },
  third: { price: 1.098, time: 1_100 },
  version: 1,
};

describe('terminal chart drawings', () => {
  it('retains only valid, bounded browser drawing records', () => {
    const saved = JSON.stringify([
      longPlan,
      { id: 'not-a-drawing', version: 99 },
      ...Array.from({ length: 110 }, (_, index) => ({
        first: { price: 1.1, time: index },
        id: `ray-${index}`,
        kind: 'HORIZONTAL_RAY',
        version: 1,
      })),
    ]);

    const parsed = parseTerminalChartDrawings(saved);

    expect(parsed).toHaveLength(100);
    expect(parsed[0]).toEqual(longPlan);
  });

  it('calculates a visual long-plan risk/reward without touching trade accounting', () => {
    expect(positionPlanStats(longPlan, 5)).toEqual({
      rewardPips: 40.000000000000036,
      riskPips: 20.000000000000018,
      riskReward: 2,
      stop: 1.098,
      target: 1.104,
    });
  });

  it('moves ordinary drawings, shifts rays vertically only, and edits selected handles', () => {
    const trend: TerminalChartDrawing = {
      first: { price: 1.1, time: 100 },
      id: 'trend',
      kind: 'TRENDLINE',
      second: { price: 1.105, time: 200 },
      version: 1,
    };
    const ray: TerminalChartDrawing = {
      first: { price: 1.1, time: 100 },
      id: 'ray',
      kind: 'HORIZONTAL_RAY',
      version: 1,
    };

    const translated = translateTerminalChartDrawing(trend, {
      price: 0.001,
      time: 10,
    });
    expect(translated.first).toMatchObject({ price: 1.101, time: 110 });
    expect(translated.second?.price).toBeCloseTo(1.106);
    expect(translated.second?.time).toBe(210);
    expect(
      translateTerminalChartDrawing(ray, { price: 0.001, time: 10 }),
    ).toMatchObject({ first: { price: 1.101, time: 100 } });
    expect(
      replaceTerminalChartDrawingPoint(trend, 'SECOND', {
        price: 1.11,
        time: 220,
      }),
    ).toMatchObject({ second: { price: 1.11, time: 220 } });
  });
});
