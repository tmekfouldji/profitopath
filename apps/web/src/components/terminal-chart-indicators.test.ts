import { describe, expect, it } from 'vitest';

import {
  cloneChartIndicatorInstances,
  createChartIndicatorInstance,
  indicatorLabel,
  maximumChartIndicatorInstances,
  validateChartIndicatorInstances,
} from './terminal-chart-indicators';

describe('chart indicator instances', () => {
  it('creates independent instances of the same study with distinct default colors', () => {
    const fast = createChartIndicatorInstance('SMA', 'sma-fast');
    const slow = createChartIndicatorInstance('SMA', 'sma-slow', 1);
    slow.period = 50;

    expect(indicatorLabel(fast)).toBe('SMA 20');
    expect(indicatorLabel(slow)).toBe('SMA 50');
    expect(slow.color).not.toBe(fast.color);
  });

  it('clones and validates independently configured study instances', () => {
    const instances = [
      createChartIndicatorInstance('EMA', 'ema-50'),
      {
        ...createChartIndicatorInstance('BOLLINGER', 'bands-20'),
        deviations: 3,
      },
    ];
    const copy = cloneChartIndicatorInstances(instances);
    copy[0]!.period = 200;

    expect(instances[0]!.period).toBe(50);
    expect(validateChartIndicatorInstances(copy)).toMatchObject({ ok: true });
  });

  it('rejects invalid instances, duplicate identifiers, and unbounded study lists', () => {
    const invalidPeriod = createChartIndicatorInstance('SMA', 'sma-1');
    invalidPeriod.period = 0;
    expect(validateChartIndicatorInstances([invalidPeriod])).toMatchObject({
      message: expect.stringContaining('length'),
      ok: false,
    });

    const invalidDeviation = createChartIndicatorInstance('BOLLINGER', 'bb-1');
    invalidDeviation.deviations = 11;
    expect(validateChartIndicatorInstances([invalidDeviation])).toMatchObject({
      message: expect.stringContaining('deviations'),
      ok: false,
    });

    const duplicate = createChartIndicatorInstance('EMA', 'same');
    expect(
      validateChartIndicatorInstances([duplicate, { ...duplicate }]),
    ).toMatchObject({
      message: expect.stringContaining('unique'),
      ok: false,
    });

    const tooMany = Array.from(
      { length: maximumChartIndicatorInstances + 1 },
      (_, index) => createChartIndicatorInstance('SMA', `sma-${index}`),
    );
    expect(validateChartIndicatorInstances(tooMany)).toMatchObject({
      message: expect.stringContaining('No more than'),
      ok: false,
    });
  });
});
