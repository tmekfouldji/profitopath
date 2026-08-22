export interface MarketCandleSeed {
  close: string;
  closeTime: Date;
  dataVersion: 1;
  high: string;
  isFinal: true;
  low: string;
  open: string;
  openTime: Date;
  source: 'MOCK_SEED';
  symbol: 'EURUSD' | 'GBPUSD';
  timeframe: '1m';
  volume: null;
}

const minuteMs = 60_000;
const candleCount = 240;

function priceFromPoints(points: number): string {
  const whole = Math.floor(points / 100_000);
  const fraction = String(points % 100_000).padStart(5, '0');
  return `${whole}.${fraction}`;
}

export function createDevelopmentCandleSeeds(
  tradingStartsAt: Date,
): readonly MarketCandleSeed[] {
  const weekendOffset = tradingStartsAt.getUTCDay() === 1 ? 2 * 86_400_000 : 0;
  const alignedClose =
    Math.floor((tradingStartsAt.getTime() - weekendOffset) / minuteMs) *
    minuteMs;
  const alignedStart = alignedClose - candleCount * minuteMs;
  const specifications = [
    { basePoints: 110_000, symbol: 'EURUSD' as const },
    { basePoints: 127_000, symbol: 'GBPUSD' as const },
  ];
  return specifications.flatMap(({ basePoints, symbol }) =>
    Array.from({ length: candleCount }, (_, index) => {
      const wave = ((index * 7) % 31) - 15;
      const openPoints = basePoints + wave + Math.floor(index / 60) * 3;
      const closeDelta = [-3, 2, 4, -1, 1][index % 5]!;
      const closePoints = openPoints + closeDelta;
      const highPoints = Math.max(openPoints, closePoints) + 2;
      const lowPoints = Math.min(openPoints, closePoints) - 2;
      const openTime = new Date(alignedStart + index * minuteMs);
      return {
        close: priceFromPoints(closePoints),
        closeTime: new Date(openTime.getTime() + minuteMs),
        dataVersion: 1,
        high: priceFromPoints(highPoints),
        isFinal: true,
        low: priceFromPoints(lowPoints),
        open: priceFromPoints(openPoints),
        openTime,
        source: 'MOCK_SEED',
        symbol,
        timeframe: '1m',
        volume: null,
      };
    }),
  );
}
