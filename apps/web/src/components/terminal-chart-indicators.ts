export type ChartIndicatorKind = 'BOLLINGER' | 'EMA' | 'SMA';

export interface ChartIndicatorInstance {
  color: string;
  deviations?: number;
  id: string;
  kind: ChartIndicatorKind;
  period: number;
}

interface IndicatorDefaults {
  color: string;
  deviations?: number;
  period: number;
}

export const chartIndicatorKinds: readonly ChartIndicatorKind[] = [
  'SMA',
  'EMA',
  'BOLLINGER',
];

export const maximumChartIndicatorInstances = 12;

const defaults: Record<ChartIndicatorKind, IndicatorDefaults> = {
  BOLLINGER: { color: '#5c8eaa', deviations: 2, period: 20 },
  EMA: { color: '#9d9df5', period: 50 },
  SMA: { color: '#e5bc67', period: 20 },
};

const colors: Record<ChartIndicatorKind, readonly string[]> = {
  BOLLINGER: ['#5c8eaa', '#d18a5c', '#72ad86', '#a27ec9'],
  EMA: ['#9d9df5', '#b977b5', '#5aa6c8', '#d49362'],
  SMA: ['#e5bc67', '#56d6c9', '#df7b88', '#8da875'],
};

export function chartIndicatorName(kind: ChartIndicatorKind): string {
  return {
    BOLLINGER: 'Bollinger Bands',
    EMA: 'Exponential moving average',
    SMA: 'Simple moving average',
  }[kind];
}

export function createChartIndicatorInstance(
  kind: ChartIndicatorKind,
  id: string,
  occurrence = 0,
): ChartIndicatorInstance {
  const initial = defaults[kind];
  return {
    ...initial,
    color: colors[kind][occurrence % colors[kind].length] ?? initial.color,
    id,
    kind,
  };
}

export function cloneChartIndicatorInstances(
  instances: readonly ChartIndicatorInstance[],
): ChartIndicatorInstance[] {
  return instances.map((instance) => ({ ...instance }));
}

export function indicatorLabel(instance: ChartIndicatorInstance): string {
  if (instance.kind === 'BOLLINGER') {
    return `BB ${instance.period}, ${instance.deviations ?? '—'}`;
  }
  return `${instance.kind} ${instance.period}`;
}

function validColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function validPeriod(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 500;
}

export function validateChartIndicatorInstances(
  instances: readonly ChartIndicatorInstance[],
):
  | { message: string; ok: false }
  | { ok: true; value: ChartIndicatorInstance[] } {
  if (instances.length > maximumChartIndicatorInstances) {
    return {
      message: `No more than ${maximumChartIndicatorInstances} studies can be displayed at once.`,
      ok: false,
    };
  }
  const ids = new Set<string>();
  for (const instance of instances) {
    if (instance.id === '' || ids.has(instance.id)) {
      return { message: 'Each study needs a unique identifier.', ok: false };
    }
    ids.add(instance.id);
    if (!validPeriod(instance.period)) {
      return {
        message: `${indicatorLabel(instance)} length must be a whole number from 1 to 500.`,
        ok: false,
      };
    }
    if (!validColor(instance.color)) {
      return {
        message: `${indicatorLabel(instance)} requires a six-digit line color.`,
        ok: false,
      };
    }
    if (
      instance.kind === 'BOLLINGER' &&
      (!Number.isFinite(instance.deviations) ||
        instance.deviations === undefined ||
        instance.deviations <= 0 ||
        instance.deviations > 10)
    ) {
      return {
        message:
          'Bollinger deviations must be greater than 0 and no more than 10.',
        ok: false,
      };
    }
  }
  return { ok: true, value: cloneChartIndicatorInstances(instances) };
}
