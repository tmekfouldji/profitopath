import type { SeedEnv } from '@profitopath/shared';

export interface TierSeed {
  code: 'ROOKIE' | 'TRADER' | 'ELITE';
  currency: 'USD';
  entryFeeMinor: number;
  maxDrawdownMinor: bigint;
  name: string;
  performanceBenchmarkMinor: bigint;
  rulesVersion: number;
  startingBalanceMinor: bigint;
}

export function createTierSeeds(config: SeedEnv): readonly TierSeed[] {
  return [
    {
      code: 'ROOKIE',
      currency: 'USD',
      entryFeeMinor: 500,
      maxDrawdownMinor: 100_000n,
      name: 'Rookie',
      performanceBenchmarkMinor: 200_000n,
      rulesVersion: 1,
      startingBalanceMinor: config.DEV_ROOKIE_STARTING_BALANCE_MINOR,
    },
    {
      code: 'TRADER',
      currency: 'USD',
      entryFeeMinor: 1_000,
      maxDrawdownMinor: 200_000n,
      name: 'Trader',
      performanceBenchmarkMinor: 400_000n,
      rulesVersion: 1,
      startingBalanceMinor: config.DEV_TRADER_STARTING_BALANCE_MINOR,
    },
    {
      code: 'ELITE',
      currency: 'USD',
      entryFeeMinor: 1_500,
      maxDrawdownMinor: 400_000n,
      name: 'Elite',
      performanceBenchmarkMinor: 600_000n,
      rulesVersion: 1,
      startingBalanceMinor: config.DEV_ELITE_STARTING_BALANCE_MINOR,
    },
  ] as const;
}
