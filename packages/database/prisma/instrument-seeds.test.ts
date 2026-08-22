import { describe, expect, it } from 'vitest';

import { createDevelopmentInstrumentSeeds } from './instrument-seeds';

describe('development instrument seeds', () => {
  it('defines exact, versioned USD-quoted mock specifications', () => {
    expect(createDevelopmentInstrumentSeeds()).toEqual([
      {
        active: true,
        baseCurrency: 'EUR',
        contractSize: '100000',
        leverage: '100',
        minimumQuantity: '0.01',
        priceScale: 5,
        quantityStep: '0.01',
        quoteCurrency: 'USD',
        symbol: 'EURUSD',
        version: 1,
      },
      {
        active: true,
        baseCurrency: 'GBP',
        contractSize: '100000',
        leverage: '100',
        minimumQuantity: '0.01',
        priceScale: 5,
        quantityStep: '0.01',
        quoteCurrency: 'USD',
        symbol: 'GBPUSD',
        version: 1,
      },
    ]);
  });
});
