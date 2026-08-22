export interface InstrumentSeed {
  active: true;
  baseCurrency: string;
  contractSize: string;
  leverage: string;
  marketHoursMode: 'UTC_24X5';
  minimumQuantity: string;
  priceScale: number;
  quantityStep: string;
  quoteCurrency: 'USD';
  symbol: 'EURUSD' | 'GBPUSD';
  version: 1;
}

export function createDevelopmentInstrumentSeeds(): readonly InstrumentSeed[] {
  return [
    {
      active: true,
      baseCurrency: 'EUR',
      contractSize: '100000',
      leverage: '100',
      marketHoursMode: 'UTC_24X5',
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
      marketHoursMode: 'UTC_24X5',
      minimumQuantity: '0.01',
      priceScale: 5,
      quantityStep: '0.01',
      quoteCurrency: 'USD',
      symbol: 'GBPUSD',
      version: 1,
    },
  ] as const;
}
