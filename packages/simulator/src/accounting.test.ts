import type { Quote } from '@profitopath/market-data';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  applyMarketFill,
  calculateAccountMetrics,
  calculateMarginMinor,
  calculatePnlMinor,
  marketFillPrice,
  type AccountingInstrument,
} from './accounting';

const instrument: AccountingInstrument = {
  contractSize: new Decimal('100000'),
  leverage: new Decimal('100'),
  minimumQuantity: new Decimal('0.01'),
  quantityStep: new Decimal('0.01'),
  symbol: 'EURUSD',
  version: 1,
};

const quote: Quote = {
  ask: new Decimal('1.1002'),
  bid: new Decimal('1.1000'),
  sequence: 1n,
  symbol: 'EURUSD',
  timestamp: new Date('2026-08-24T09:00:00.000Z'),
};

describe('simulator accounting', () => {
  it('fills buys at ask and sells at bid with spread reflected in P&L', () => {
    expect(marketFillPrice('BUY', quote).toString()).toBe('1.1002');
    expect(marketFillPrice('SELL', quote).toString()).toBe('1.1');
    expect(
      calculatePnlMinor(
        'LONG',
        quote.ask,
        quote.bid,
        new Decimal('1'),
        instrument,
      ),
    ).toBe(-2_000n);
    expect(
      calculatePnlMinor(
        'SHORT',
        quote.bid,
        quote.ask,
        new Decimal('1'),
        instrument,
      ),
    ).toBe(-2_000n);
  });

  it('calculates margin in minor units and rounds exposure upward', () => {
    expect(
      calculateMarginMinor(new Decimal('0.01'), quote.ask, instrument),
    ).toBe(1_101n);
  });

  it('opens and increases a weighted long position', () => {
    const opened = applyMarketFill(
      null,
      'BUY',
      new Decimal('1'),
      new Decimal('1.1'),
      instrument,
    );
    const increased = applyMarketFill(
      opened.nextPosition,
      'BUY',
      new Decimal('1'),
      new Decimal('1.2'),
      instrument,
    );

    expect(increased.kind).toBe('INCREASE');
    expect(increased.nextPosition?.quantity.toString()).toBe('2');
    expect(increased.nextPosition?.averageEntryPrice.toString()).toBe('1.15');
  });

  it('reduces and closes a long with deterministic realized P&L', () => {
    const existing = {
      averageEntryPrice: new Decimal('1.1'),
      quantity: new Decimal('1'),
      side: 'LONG' as const,
    };
    const reduced = applyMarketFill(
      existing,
      'SELL',
      new Decimal('0.4'),
      new Decimal('1.11'),
      instrument,
    );
    const closed = applyMarketFill(
      reduced.nextPosition,
      'SELL',
      new Decimal('0.6'),
      new Decimal('1.09'),
      instrument,
    );

    expect(reduced.kind).toBe('REDUCE');
    expect(reduced.realizedPnlMinor).toBe(40_000n);
    expect(closed.kind).toBe('CLOSE');
    expect(closed.realizedPnlMinor).toBe(-60_000n);
    expect(closed.nextPosition).toBeNull();
  });

  it('reverses a short into a long while realizing only closed quantity', () => {
    const reversed = applyMarketFill(
      {
        averageEntryPrice: new Decimal('1.2'),
        quantity: new Decimal('1'),
        side: 'SHORT',
      },
      'BUY',
      new Decimal('1.5'),
      new Decimal('1.1'),
      instrument,
    );

    expect(reversed.kind).toBe('REVERSE');
    expect(reversed.realizedPnlMinor).toBe(1_000_000n);
    expect(reversed.nextPosition?.side).toBe('LONG');
    expect(reversed.nextPosition?.quantity.toString()).toBe('0.5');
    expect(reversed.nextPosition?.averageEntryPrice.toString()).toBe('1.1');
  });

  it('marks positions at executable close prices and derives account metrics', () => {
    expect(
      calculateAccountMetrics(1_000_000n, [
        {
          averageEntryPrice: quote.ask,
          instrument,
          quantity: new Decimal('0.1'),
          quote,
          side: 'LONG',
        },
      ]),
    ).toEqual({
      balanceMinor: 1_000_000n,
      equityMinor: 999_800n,
      marginFreeMinor: 988_800n,
      marginUsedMinor: 11_000n,
      unrealizedPnlMinor: -200n,
    });
  });
});
