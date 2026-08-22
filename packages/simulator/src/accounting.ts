import Decimal from 'decimal.js';

import type { Quote } from '@profitopath/market-data';

export type TradeSide = 'BUY' | 'SELL';
export type NetPositionSide = 'LONG' | 'SHORT';

export interface AccountingInstrument {
  contractSize: Decimal;
  leverage: Decimal;
  minimumQuantity: Decimal;
  quantityStep: Decimal;
  symbol: string;
  version: number;
}

export interface NetPosition {
  averageEntryPrice: Decimal;
  quantity: Decimal;
  side: NetPositionSide;
}

export interface PositionWithQuote extends NetPosition {
  instrument: AccountingInstrument;
  quote: Quote;
}

export type PositionMutationKind =
  'OPEN' | 'INCREASE' | 'REDUCE' | 'CLOSE' | 'REVERSE';

export interface PositionMutation {
  closedQuantity: Decimal;
  kind: PositionMutationKind;
  nextPosition: NetPosition | null;
  realizedPnlMinor: bigint;
}

export interface AccountMetrics {
  balanceMinor: bigint;
  equityMinor: bigint;
  marginFreeMinor: bigint;
  marginUsedMinor: bigint;
  unrealizedPnlMinor: bigint;
}

const accountMinorScale = 2;

export class InvalidOrderQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrderQuantityError';
  }
}

export function decimalToMinor(
  value: Decimal,
  scale = accountMinorScale,
): bigint {
  const rounded = value
    .mul(new Decimal(10).pow(scale))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  return BigInt(rounded.toFixed(0));
}

export function minorToDecimal(
  value: bigint,
  scale = accountMinorScale,
): Decimal {
  return new Decimal(value.toString()).div(new Decimal(10).pow(scale));
}

export function assertValidOrderQuantity(
  quantity: Decimal,
  instrument: AccountingInstrument,
): void {
  if (!quantity.isFinite() || !quantity.greaterThan(0)) {
    throw new InvalidOrderQuantityError('Quantity must be positive');
  }
  if (quantity.lessThan(instrument.minimumQuantity)) {
    throw new InvalidOrderQuantityError('Quantity is below the minimum');
  }
  if (!quantity.mod(instrument.quantityStep).isZero()) {
    throw new InvalidOrderQuantityError('Quantity does not match the step');
  }
}

export function marketFillPrice(side: TradeSide, quote: Quote): Decimal {
  return side === 'BUY' ? quote.ask : quote.bid;
}

export function positionClosePrice(
  side: NetPositionSide,
  quote: Quote,
): Decimal {
  return side === 'LONG' ? quote.bid : quote.ask;
}

export function calculateNotional(
  quantity: Decimal,
  price: Decimal,
  instrument: AccountingInstrument,
): Decimal {
  return quantity.mul(instrument.contractSize).mul(price);
}

export function calculateMarginMinor(
  quantity: Decimal,
  price: Decimal,
  instrument: AccountingInstrument,
): bigint {
  const margin = calculateNotional(quantity, price, instrument).div(
    instrument.leverage,
  );
  const rounded = margin
    .mul(new Decimal(10).pow(accountMinorScale))
    .toDecimalPlaces(0, Decimal.ROUND_CEIL);
  return BigInt(rounded.toFixed(0));
}

export function calculatePnlMinor(
  positionSide: NetPositionSide,
  entryPrice: Decimal,
  exitPrice: Decimal,
  quantity: Decimal,
  instrument: AccountingInstrument,
): bigint {
  return decimalToMinor(
    calculatePnl(positionSide, entryPrice, exitPrice, quantity, instrument),
  );
}

export function calculatePnl(
  positionSide: NetPositionSide,
  entryPrice: Decimal,
  exitPrice: Decimal,
  quantity: Decimal,
  instrument: AccountingInstrument,
): Decimal {
  const priceChange =
    positionSide === 'LONG'
      ? exitPrice.minus(entryPrice)
      : entryPrice.minus(exitPrice);
  return priceChange.mul(quantity).mul(instrument.contractSize);
}

export function weightedEntryPrice(
  existing: NetPosition,
  addedQuantity: Decimal,
  addedPrice: Decimal,
): Decimal {
  return existing.averageEntryPrice
    .mul(existing.quantity)
    .plus(addedPrice.mul(addedQuantity))
    .div(existing.quantity.plus(addedQuantity));
}

export function applyMarketFill(
  existing: NetPosition | null,
  side: TradeSide,
  quantity: Decimal,
  fillPrice: Decimal,
  instrument: AccountingInstrument,
): PositionMutation {
  assertValidOrderQuantity(quantity, instrument);
  const targetSide: NetPositionSide = side === 'BUY' ? 'LONG' : 'SHORT';
  if (existing === null) {
    return {
      closedQuantity: new Decimal(0),
      kind: 'OPEN',
      nextPosition: {
        averageEntryPrice: fillPrice,
        quantity,
        side: targetSide,
      },
      realizedPnlMinor: 0n,
    };
  }

  if (existing.side === targetSide) {
    return {
      closedQuantity: new Decimal(0),
      kind: 'INCREASE',
      nextPosition: {
        averageEntryPrice: weightedEntryPrice(existing, quantity, fillPrice),
        quantity: existing.quantity.plus(quantity),
        side: existing.side,
      },
      realizedPnlMinor: 0n,
    };
  }

  const closedQuantity = Decimal.min(existing.quantity, quantity);
  const realizedPnlMinor = calculatePnlMinor(
    existing.side,
    existing.averageEntryPrice,
    fillPrice,
    closedQuantity,
    instrument,
  );
  if (quantity.lessThan(existing.quantity)) {
    return {
      closedQuantity,
      kind: 'REDUCE',
      nextPosition: {
        averageEntryPrice: existing.averageEntryPrice,
        quantity: existing.quantity.minus(quantity),
        side: existing.side,
      },
      realizedPnlMinor,
    };
  }
  if (quantity.equals(existing.quantity)) {
    return {
      closedQuantity,
      kind: 'CLOSE',
      nextPosition: null,
      realizedPnlMinor,
    };
  }
  return {
    closedQuantity,
    kind: 'REVERSE',
    nextPosition: {
      averageEntryPrice: fillPrice,
      quantity: quantity.minus(existing.quantity),
      side: targetSide,
    },
    realizedPnlMinor,
  };
}

export function calculateAccountMetrics(
  balanceMinor: bigint,
  positions: readonly PositionWithQuote[],
): AccountMetrics {
  let unrealizedPnlMinor = 0n;
  let marginUsedMinor = 0n;
  for (const position of positions) {
    const closePrice = positionClosePrice(position.side, position.quote);
    unrealizedPnlMinor += calculatePnlMinor(
      position.side,
      position.averageEntryPrice,
      closePrice,
      position.quantity,
      position.instrument,
    );
    marginUsedMinor += calculateMarginMinor(
      position.quantity,
      closePrice,
      position.instrument,
    );
  }
  const equityMinor = balanceMinor + unrealizedPnlMinor;
  return {
    balanceMinor,
    equityMinor,
    marginFreeMinor: equityMinor - marginUsedMinor,
    marginUsedMinor,
    unrealizedPnlMinor,
  };
}
