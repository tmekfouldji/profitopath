import { describe, expect, it } from 'vitest';

import {
  TwelveDataTrialInstrumentConfigurationError,
  twelveDataTrialInstrumentConfigs,
} from './twelve-data-trial-configuration';

describe('Twelve Data trial instrument configuration', () => {
  it('requires a full server-owned spread for every approved trial symbol', () => {
    expect(
      twelveDataTrialInstrumentConfigs({
        EURUSD: '0.00012',
        GBPUSD: '0.00024',
      }),
    ).toEqual([
      { fullSpread: '0.00012', symbol: 'EURUSD' },
      { fullSpread: '0.00024', symbol: 'GBPUSD' },
    ]);
    expect(() =>
      twelveDataTrialInstrumentConfigs({ EURUSD: '0.00012' }),
    ).toThrow(TwelveDataTrialInstrumentConfigurationError);
  });
});
