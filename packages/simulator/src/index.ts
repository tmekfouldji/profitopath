import type { Decimal } from 'decimal.js';

export * from './accounting';
export * from './engine';
export * from './mock-runtime';

export interface SymbolSpecification {
  baseCurrency: string;
  contractSize: Decimal;
  leverage: Decimal;
  priceScale: number;
  quoteCurrency: string;
  quantityStep: Decimal;
  symbol: string;
  version: number;
}

export interface SimulatedOrderRequest {
  clientOrderId: string;
  quantity: Decimal;
  side: 'BUY' | 'SELL';
  symbol: string;
  tradingAccountId: string;
  type: 'MARKET' | 'LIMIT' | 'STOP';
}

export interface SimulatedExecutionEngine {
  submitOrder(request: SimulatedOrderRequest): Promise<{ orderId: string }>;
}
