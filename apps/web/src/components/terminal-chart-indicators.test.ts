import { describe, expect, it } from 'vitest';

import {
  cloneChartIndicatorSettings,
  defaultChartIndicatorSettings,
  indicatorLabel,
  validateChartIndicatorSettings,
} from './terminal-chart-indicators';

describe('terminal chart indicator settings', () => {
  it('labels settings using the live configured periods', () => {
    const settings = cloneChartIndicatorSettings(defaultChartIndicatorSettings);
    settings.SMA_20.period = 34;
    settings.BOLLINGER.deviations = 2.5;

    expect(indicatorLabel('SMA_20', settings)).toBe('SMA 34');
    expect(indicatorLabel('BOLLINGER', settings)).toBe('BB 20, 2.5');
  });

  it('accepts a bounded valid configuration', () => {
    const settings = cloneChartIndicatorSettings(defaultChartIndicatorSettings);
    settings.EMA_50.period = 200;
    settings.BOLLINGER.deviations = 3;

    expect(validateChartIndicatorSettings(settings)).toMatchObject({
      ok: true,
    });
  });

  it('rejects invalid length, deviation, and color values before they reach a chart study', () => {
    const invalidPeriod = cloneChartIndicatorSettings(
      defaultChartIndicatorSettings,
    );
    invalidPeriod.SMA_20.period = 0;
    expect(validateChartIndicatorSettings(invalidPeriod)).toMatchObject({
      ok: false,
    });

    const invalidDeviation = cloneChartIndicatorSettings(
      defaultChartIndicatorSettings,
    );
    invalidDeviation.BOLLINGER.deviations = 11;
    expect(validateChartIndicatorSettings(invalidDeviation)).toMatchObject({
      ok: false,
    });

    const invalidColor = cloneChartIndicatorSettings(
      defaultChartIndicatorSettings,
    );
    invalidColor.EMA_50.color = 'aqua';
    expect(validateChartIndicatorSettings(invalidColor)).toMatchObject({
      ok: false,
    });
  });
});
