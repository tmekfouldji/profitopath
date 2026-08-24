export interface ChartStudyCandle {
  close: number;
  time: number;
}

export interface BollingerBandPoint {
  lower: number;
  middle: number;
  time: number;
  upper: number;
}

function trailingWindow(
  candles: readonly ChartStudyCandle[],
  endIndex: number,
  period: number,
): readonly ChartStudyCandle[] {
  return candles.slice(endIndex - period + 1, endIndex + 1);
}

export function simpleMovingAverage(
  candles: readonly ChartStudyCandle[],
  period: number,
): ChartStudyCandle[] {
  if (period <= 0) return [];
  return candles.flatMap((candle, index) => {
    if (index < period - 1) return [];
    const average = trailingWindow(candles, index, period).reduce(
      (total, value) => total + value.close,
      0,
    );
    return [{ time: candle.time, close: average / period }];
  });
}

export function exponentialMovingAverage(
  candles: readonly ChartStudyCandle[],
  period: number,
): ChartStudyCandle[] {
  if (period <= 0 || candles.length < period) return [];
  const multiplier = 2 / (period + 1);
  const initial = simpleMovingAverage(candles.slice(0, period), period)[0];
  if (initial === undefined) return [];
  let previous = initial.close;
  const output: ChartStudyCandle[] = [initial];
  for (const candle of candles.slice(period)) {
    previous = (candle.close - previous) * multiplier + previous;
    output.push({ close: previous, time: candle.time });
  }
  return output;
}

export function bollingerBands(
  candles: readonly ChartStudyCandle[],
  period: number,
  deviations: number,
): BollingerBandPoint[] {
  if (period <= 0 || deviations < 0) return [];
  return candles.flatMap((candle, index) => {
    if (index < period - 1) return [];
    const window = trailingWindow(candles, index, period);
    const middle =
      window.reduce((total, value) => total + value.close, 0) / period;
    const variance =
      window.reduce((total, value) => total + (value.close - middle) ** 2, 0) /
      period;
    const offset = Math.sqrt(variance) * deviations;
    return [
      {
        lower: middle - offset,
        middle,
        time: candle.time,
        upper: middle + offset,
      },
    ];
  });
}
