import type { Quote } from '@profitopath/market-data';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import type { AccountingInstrument } from './accounting';
import {
  assertProtectionPricePlacement,
  assertValidOrderPrice,
  isMarketOpen,
  protectionOrderSide,
  shouldTriggerPendingOrder,
  shouldTriggerProtectionOrder,
} from './order-policy';

const instrument: AccountingInstrument = {
  contractSize: new Decimal('100000'),
  leverage: new Decimal('100'),
  marketHoursMode: 'UTC_24X5',
  minimumQuantity: new Decimal('0.01'),
  priceScale: 5,
  quantityStep: new Decimal('0.01'),
  symbol: 'EURUSD',
  version: 1,
};

const quote: Quote = {
  ask: new Decimal('1.10020'),
  bid: new Decimal('1.10000'),
  sequence: 7n,
  symbol: 'EURUSD',
  timestamp: new Date('2026-08-24T09:00:00.000Z'),
};

describe('pending and protective order policy', () => {
  it('validates positive prices at instrument precision', () => {
    expect(() => assertValidOrderPrice(new Decimal('0'), instrument)).toThrow(
      'Order price must be positive',
    );
    expect(() =>
      assertValidOrderPrice(new Decimal('1.123456'), instrument),
    ).toThrow('Order price supports at most 5 decimal places');
    expect(() =>
      assertValidOrderPrice(new Decimal('1.12345'), instrument),
    ).not.toThrow();
  });

  it('uses executable ask/bid for all pending trigger directions', () => {
    expect(
      shouldTriggerPendingOrder({
        quote,
        side: 'BUY',
        triggerPrice: new Decimal('1.10020'),
        type: 'LIMIT',
      }),
    ).toBe(true);
    expect(
      shouldTriggerPendingOrder({
        quote,
        side: 'SELL',
        triggerPrice: new Decimal('1.10000'),
        type: 'LIMIT',
      }),
    ).toBe(true);
    expect(
      shouldTriggerPendingOrder({
        quote,
        side: 'BUY',
        triggerPrice: new Decimal('1.10020'),
        type: 'STOP',
      }),
    ).toBe(true);
    expect(
      shouldTriggerPendingOrder({
        quote,
        side: 'SELL',
        triggerPrice: new Decimal('1.10000'),
        type: 'STOP',
      }),
    ).toBe(true);
  });

  it('validates and triggers long/short protection on executable close sides', () => {
    expect(protectionOrderSide('LONG')).toBe('SELL');
    expect(protectionOrderSide('SHORT')).toBe('BUY');
    expect(() =>
      assertProtectionPricePlacement({
        positionSide: 'LONG',
        price: new Decimal('1.09900'),
        quote,
        type: 'STOP_LOSS',
      }),
    ).not.toThrow();
    expect(() =>
      assertProtectionPricePlacement({
        positionSide: 'SHORT',
        price: new Decimal('1.09900'),
        quote,
        type: 'STOP_LOSS',
      }),
    ).toThrow('wrong side');
    expect(
      shouldTriggerProtectionOrder({
        positionSide: 'LONG',
        price: new Decimal('1.10000'),
        quote,
        type: 'TAKE_PROFIT',
      }),
    ).toBe(true);
    expect(
      shouldTriggerProtectionOrder({
        positionSide: 'SHORT',
        price: new Decimal('1.10020'),
        quote,
        type: 'STOP_LOSS',
      }),
    ).toBe(true);
  });

  it('uses the versioned UTC weekday schedule', () => {
    expect(isMarketOpen(new Date('2026-08-24T00:00:00Z'), 'UTC_24X5')).toBe(
      true,
    );
    expect(isMarketOpen(new Date('2026-08-29T00:00:00Z'), 'UTC_24X5')).toBe(
      false,
    );
    expect(isMarketOpen(new Date('2026-08-30T23:59:59Z'), 'UTC_24X5')).toBe(
      false,
    );
  });
});
