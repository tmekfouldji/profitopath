import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  InvalidQuoteError,
  OutOfOrderQuoteError,
  StaleQuoteError,
  ValidatedQuoteBook,
} from './quote-validator';

function quote(sequence: bigint, bid = '1.1000', ask = '1.1002') {
  return {
    ask: new Decimal(ask),
    bid: new Decimal(bid),
    sequence,
    symbol: 'EURUSD',
    timestamp: new Date('2026-08-24T09:00:00.000Z'),
  };
}

describe('ValidatedQuoteBook', () => {
  it('accepts a quote once and treats an identical sequence as a duplicate', () => {
    const book = new ValidatedQuoteBook(5_000);
    const receivedAt = new Date('2026-08-24T09:00:01.000Z');

    expect(book.accept(quote(1n), receivedAt)).toBe(true);
    expect(book.accept(quote(1n), receivedAt)).toBe(false);
  });

  it('rejects crossed, stale, and out-of-order quotes', () => {
    const book = new ValidatedQuoteBook(5_000);
    const receivedAt = new Date('2026-08-24T09:00:01.000Z');

    expect(() => book.accept(quote(1n, '1.2', '1.1'), receivedAt)).toThrow(
      InvalidQuoteError,
    );
    expect(() =>
      book.accept(quote(1n), new Date('2026-08-24T09:00:06.000Z')),
    ).toThrow(StaleQuoteError);
    expect(book.accept(quote(2n), receivedAt)).toBe(true);
    expect(() => book.accept(quote(1n), receivedAt)).toThrow(
      OutOfOrderQuoteError,
    );
  });
});
