export interface ChartConstraintPoint {
  price: number;
  time: number;
  x: number;
  y: number;
}

export interface ChartSnapCandle {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
}

export function constrainTrendLinePoint(input: {
  current: ChartConstraintPoint;
  shiftKey: boolean;
  start: ChartConstraintPoint;
}): ChartConstraintPoint {
  if (!input.shiftKey) return input.current;
  const horizontal =
    Math.abs(input.current.x - input.start.x) >=
    Math.abs(input.current.y - input.start.y);
  return horizontal
    ? { ...input.current, price: input.start.price, y: input.start.y }
    : { ...input.current, time: input.start.time, x: input.start.x };
}

export function snapChartPointToCandleOhlc(input: {
  candles: readonly ChartSnapCandle[];
  point: ChartConstraintPoint;
}): ChartConstraintPoint {
  const candle = input.candles.find((item) => item.time === input.point.time);
  if (candle === undefined) return input.point;
  const price = [candle.open, candle.high, candle.low, candle.close].reduce(
    (closest, candidate) =>
      Math.abs(candidate - input.point.price) <
      Math.abs(closest - input.point.price)
        ? candidate
        : closest,
  );
  return { ...input.point, price };
}
