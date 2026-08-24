export type TerminalChartDrawingKind =
  | 'HORIZONTAL_RAY'
  | 'LONG_POSITION'
  | 'RECTANGLE'
  | 'SHORT_POSITION'
  | 'TRENDLINE';

export interface TerminalChartDrawingPoint {
  price: number;
  time: number;
}

export interface TerminalChartDrawing {
  first: TerminalChartDrawingPoint;
  id: string;
  kind: TerminalChartDrawingKind;
  second?: TerminalChartDrawingPoint;
  third?: TerminalChartDrawingPoint;
  version: 1;
}

export interface PositionPlanStats {
  rewardPips: number;
  riskPips: number;
  riskReward: number;
  stop: number;
  target: number;
}

const drawingKinds: readonly TerminalChartDrawingKind[] = [
  'HORIZONTAL_RAY',
  'LONG_POSITION',
  'RECTANGLE',
  'SHORT_POSITION',
  'TRENDLINE',
];

function isPoint(value: unknown): value is TerminalChartDrawingPoint {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.price === 'number' &&
    Number.isFinite(point.price) &&
    typeof point.time === 'number' &&
    Number.isFinite(point.time)
  );
}

function requiresSecond(kind: TerminalChartDrawingKind): boolean {
  return kind !== 'HORIZONTAL_RAY';
}

function requiresThird(kind: TerminalChartDrawingKind): boolean {
  return kind === 'LONG_POSITION' || kind === 'SHORT_POSITION';
}

export function isTerminalChartDrawing(
  value: unknown,
): value is TerminalChartDrawing {
  if (typeof value !== 'object' || value === null) return false;
  const drawing = value as Record<string, unknown>;
  if (
    drawing.version !== 1 ||
    typeof drawing.id !== 'string' ||
    drawing.id.length === 0 ||
    !drawingKinds.includes(drawing.kind as TerminalChartDrawingKind) ||
    !isPoint(drawing.first)
  ) {
    return false;
  }
  const kind = drawing.kind as TerminalChartDrawingKind;
  return (
    (!requiresSecond(kind) || isPoint(drawing.second)) &&
    (!requiresThird(kind) || isPoint(drawing.third))
  );
}

export function parseTerminalChartDrawings(
  value: string | null,
): TerminalChartDrawing[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTerminalChartDrawing).slice(0, 100);
  } catch {
    return [];
  }
}

export function translateTerminalChartDrawing(
  drawing: TerminalChartDrawing,
  delta: TerminalChartDrawingPoint,
): TerminalChartDrawing {
  function translate(point: TerminalChartDrawingPoint | undefined) {
    if (point === undefined) return undefined;
    return {
      price: point.price + delta.price,
      time: point.time + delta.time,
    };
  }
  if (drawing.kind === 'HORIZONTAL_RAY') {
    return {
      ...drawing,
      first: { ...drawing.first, price: drawing.first.price + delta.price },
    };
  }
  const second = translate(drawing.second);
  const third = translate(drawing.third);
  return {
    ...drawing,
    first: translate(drawing.first)!,
    ...(second === undefined ? {} : { second }),
    ...(third === undefined ? {} : { third }),
  };
}

export function replaceTerminalChartDrawingPoint(
  drawing: TerminalChartDrawing,
  point: 'FIRST' | 'SECOND' | 'THIRD',
  value: TerminalChartDrawingPoint,
): TerminalChartDrawing {
  if (point === 'FIRST') {
    return { ...drawing, first: value };
  }
  if (point === 'SECOND' && drawing.second !== undefined) {
    return { ...drawing, second: value };
  }
  if (point === 'THIRD' && drawing.third !== undefined) {
    return { ...drawing, third: value };
  }
  return drawing;
}

export function positionPlanStats(
  drawing: TerminalChartDrawing,
  priceScale: number,
): PositionPlanStats | null {
  if (
    (drawing.kind !== 'LONG_POSITION' && drawing.kind !== 'SHORT_POSITION') ||
    drawing.second === undefined ||
    drawing.third === undefined
  ) {
    return null;
  }
  const entry = drawing.first.price;
  const target = drawing.second.price;
  const stop = drawing.third.price;
  const reward =
    drawing.kind === 'LONG_POSITION' ? target - entry : entry - target;
  const risk = drawing.kind === 'LONG_POSITION' ? entry - stop : stop - entry;
  if (reward <= 0 || risk <= 0) return null;
  const pipMultiplier = 10 ** Math.max(0, priceScale - 1);
  return {
    rewardPips: reward * pipMultiplier,
    riskPips: risk * pipMultiplier,
    riskReward: reward / risk,
    stop,
    target,
  };
}
