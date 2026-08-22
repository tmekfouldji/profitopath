import type { Decimal } from 'decimal.js';

export interface Quote {
  ask: Decimal;
  bid: Decimal;
  sequence: bigint;
  symbol: string;
  timestamp: Date;
}

export interface Bar {
  close: Decimal;
  high: Decimal;
  low: Decimal;
  open: Decimal;
  openedAt: Date;
  symbol: string;
}

export interface HistoricalBarsRequest {
  from: Date;
  limit: number;
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  to: Date;
}

export type QuoteHandler = (quote: Quote) => Promise<void>;

export interface MarketDataProvider {
  getHistoricalBars(input: HistoricalBarsRequest): Promise<Bar[]>;
  getLatestQuote(symbol: string): Promise<Quote>;
  onQuote(handler: QuoteHandler): void;
  subscribe(symbols: string[]): Promise<void>;
}
