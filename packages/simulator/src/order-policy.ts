import type { Quote } from '@profitopath/market-data';
import type Decimal from 'decimal.js';

import type {
  AccountingInstrument,
  NetPositionSide,
  TradeSide,
} from './accounting';

export type PendingOrderType = 'LIMIT' | 'STOP';
export type ProtectionOrderType = 'STOP_LOSS' | 'TAKE_PROFIT';

export class InvalidOrderPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrderPriceError';
  }
}

export function assertValidOrderPrice(
  price: Decimal,
  instrument: AccountingInstrument,
): void {
  if (!price.isFinite() || !price.greaterThan(0)) {
    throw new InvalidOrderPriceError('Order price must be positive');
  }
  if (price.decimalPlaces() > instrument.priceScale) {
    throw new InvalidOrderPriceError(
      `Order price supports at most ${instrument.priceScale} decimal places`,
    );
  }
}

export function isMarketOpen(
  at: Date,
  mode: AccountingInstrument['marketHoursMode'],
): boolean {
  if (mode !== 'UTC_24X5' || Number.isNaN(at.getTime())) {
    return false;
  }
  const day = at.getUTCDay();
  return day >= 1 && day <= 5;
}

export function shouldTriggerPendingOrder(input: {
  quote: Quote;
  side: TradeSide;
  triggerPrice: Decimal;
  type: PendingOrderType;
}): boolean {
  const executablePrice =
    input.side === 'BUY' ? input.quote.ask : input.quote.bid;
  if (input.type === 'LIMIT') {
    return input.side === 'BUY'
      ? executablePrice.lessThanOrEqualTo(input.triggerPrice)
      : executablePrice.greaterThanOrEqualTo(input.triggerPrice);
  }
  return input.side === 'BUY'
    ? executablePrice.greaterThanOrEqualTo(input.triggerPrice)
    : executablePrice.lessThanOrEqualTo(input.triggerPrice);
}

export function protectionOrderSide(positionSide: NetPositionSide): TradeSide {
  return positionSide === 'LONG' ? 'SELL' : 'BUY';
}

export function assertProtectionPricePlacement(input: {
  positionSide: NetPositionSide;
  price: Decimal;
  quote: Quote;
  type: ProtectionOrderType;
}): void {
  const reference =
    input.positionSide === 'LONG' ? input.quote.bid : input.quote.ask;
  const valid =
    input.type === 'STOP_LOSS'
      ? input.positionSide === 'LONG'
        ? input.price.lessThan(reference)
        : input.price.greaterThan(reference)
      : input.positionSide === 'LONG'
        ? input.price.greaterThan(reference)
        : input.price.lessThan(reference);
  if (!valid) {
    throw new InvalidOrderPriceError(
      `${input.type} price is on the wrong side of the executable market`,
    );
  }
}

export function shouldTriggerProtectionOrder(input: {
  positionSide: NetPositionSide;
  price: Decimal;
  quote: Quote;
  type: ProtectionOrderType;
}): boolean {
  const executable =
    input.positionSide === 'LONG' ? input.quote.bid : input.quote.ask;
  if (input.type === 'STOP_LOSS') {
    return input.positionSide === 'LONG'
      ? executable.lessThanOrEqualTo(input.price)
      : executable.greaterThanOrEqualTo(input.price);
  }
  return input.positionSide === 'LONG'
    ? executable.greaterThanOrEqualTo(input.price)
    : executable.lessThanOrEqualTo(input.price);
}
