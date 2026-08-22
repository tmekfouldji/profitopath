import { describe, expect, it } from 'vitest';

import { createTierSeeds } from './tier-seeds';

describe('challenge tier seeds', () => {
  it('preserves approved entry, drawdown, and benchmark values', () => {
    const tiers = createTierSeeds({
      DEV_ELITE_STARTING_BALANCE_MINOR: 3n,
      DEV_ROOKIE_STARTING_BALANCE_MINOR: 1n,
      DEV_TRADER_STARTING_BALANCE_MINOR: 2n,
    });

    expect(
      tiers.map(
        ({
          code,
          entryFeeMinor,
          maxDrawdownMinor,
          performanceBenchmarkMinor,
        }) => ({
          code,
          entryFeeMinor,
          maxDrawdownMinor,
          performanceBenchmarkMinor,
        }),
      ),
    ).toEqual([
      {
        code: 'ROOKIE',
        entryFeeMinor: 500,
        maxDrawdownMinor: 100_000n,
        performanceBenchmarkMinor: 200_000n,
      },
      {
        code: 'TRADER',
        entryFeeMinor: 1_000,
        maxDrawdownMinor: 200_000n,
        performanceBenchmarkMinor: 400_000n,
      },
      {
        code: 'ELITE',
        entryFeeMinor: 1_500,
        maxDrawdownMinor: 400_000n,
        performanceBenchmarkMinor: 600_000n,
      },
    ]);
  });

  it('uses explicit development starting balances from configuration', () => {
    const tiers = createTierSeeds({
      DEV_ELITE_STARTING_BALANCE_MINOR: 33n,
      DEV_ROOKIE_STARTING_BALANCE_MINOR: 11n,
      DEV_TRADER_STARTING_BALANCE_MINOR: 22n,
    });

    expect(tiers.map((tier) => tier.startingBalanceMinor)).toEqual([
      11n,
      22n,
      33n,
    ]);
  });
});
