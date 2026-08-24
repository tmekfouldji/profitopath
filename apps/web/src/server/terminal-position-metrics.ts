import { decimalToMinor } from '@profitopath/simulator';
import Decimal from 'decimal.js';

export interface LivePositionMetricInput {
  ask: Decimal | null;
  averageEntryPrice: Decimal;
  bid: Decimal | null;
  contractSize: Decimal;
  priceScale: number;
  quantity: Decimal;
  side: 'LONG' | 'SHORT';
}

export interface LivePositionMetrics {
  markPrice: string;
  unrealizedPips: string;
  unrealizedPnlMinor: string;
}

export function calculateLivePositionMetrics(
  input: LivePositionMetricInput,
): LivePositionMetrics | null {
  const markPrice = input.side === 'LONG' ? input.bid : input.ask;
  if (markPrice === null) return null;
  const priceChange =
    input.side === 'LONG'
      ? markPrice.minus(input.averageEntryPrice)
      : input.averageEntryPrice.minus(markPrice);
  const pipSize = new Decimal(10).pow(-Math.max(0, input.priceScale - 1));
  return {
    markPrice: markPrice.toString(),
    unrealizedPips: priceChange.div(pipSize).toDecimalPlaces(1).toFixed(1),
    unrealizedPnlMinor: decimalToMinor(
      priceChange.mul(input.quantity).mul(input.contractSize),
    ).toString(),
  };
}
