export type ChartIndicatorId = 'BOLLINGER' | 'EMA_50' | 'SMA_20';

interface MovingAverageSettings {
  color: string;
  period: number;
}

interface BollingerSettings extends MovingAverageSettings {
  deviations: number;
}

export interface ChartIndicatorSettings {
  BOLLINGER: BollingerSettings;
  EMA_50: MovingAverageSettings;
  SMA_20: MovingAverageSettings;
}

export const defaultChartIndicatorSettings: ChartIndicatorSettings = {
  BOLLINGER: { color: '#5c8eaa', deviations: 2, period: 20 },
  EMA_50: { color: '#9d9df5', period: 50 },
  SMA_20: { color: '#e5bc67', period: 20 },
};

const indicatorIds: readonly ChartIndicatorId[] = [
  'SMA_20',
  'EMA_50',
  'BOLLINGER',
];

export function cloneChartIndicatorSettings(
  settings: ChartIndicatorSettings,
): ChartIndicatorSettings {
  return {
    BOLLINGER: { ...settings.BOLLINGER },
    EMA_50: { ...settings.EMA_50 },
    SMA_20: { ...settings.SMA_20 },
  };
}

export function indicatorLabel(
  indicator: ChartIndicatorId,
  settings: ChartIndicatorSettings,
): string {
  if (indicator === 'BOLLINGER') {
    return `BB ${settings.BOLLINGER.period}, ${settings.BOLLINGER.deviations}`;
  }
  return `${indicator === 'SMA_20' ? 'SMA' : 'EMA'} ${settings[indicator].period}`;
}

function validColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function validPeriod(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 500;
}

export function validateChartIndicatorSettings(
  settings: ChartIndicatorSettings,
):
  { message: string; ok: false } | { ok: true; value: ChartIndicatorSettings } {
  for (const indicator of indicatorIds) {
    const values = settings[indicator];
    if (!validPeriod(values.period)) {
      return {
        message: `${indicatorLabel(indicator, settings)} length must be a whole number from 1 to 500.`,
        ok: false,
      };
    }
    if (!validColor(values.color)) {
      return {
        message: `${indicator} requires a six-digit line color.`,
        ok: false,
      };
    }
  }
  if (
    !Number.isFinite(settings.BOLLINGER.deviations) ||
    settings.BOLLINGER.deviations <= 0 ||
    settings.BOLLINGER.deviations > 10
  ) {
    return {
      message:
        'Bollinger deviations must be greater than 0 and no more than 10.',
      ok: false,
    };
  }
  return { ok: true, value: cloneChartIndicatorSettings(settings) };
}
