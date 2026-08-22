import { parseSeedEnv } from '@profitopath/shared';

import { database } from '../src/client';
import { createTierSeeds } from './tier-seeds';

async function seed(): Promise<void> {
  const tiers = createTierSeeds(parseSeedEnv());

  await database.$transaction(
    tiers.map((tier) =>
      database.challengeTier.upsert({
        create: tier,
        update: {
          active: true,
          currency: tier.currency,
          entryFeeMinor: tier.entryFeeMinor,
          maxDrawdownMinor: tier.maxDrawdownMinor,
          name: tier.name,
          performanceBenchmarkMinor: tier.performanceBenchmarkMinor,
          rulesVersion: tier.rulesVersion,
          startingBalanceMinor: tier.startingBalanceMinor,
        },
        where: { code: tier.code },
      }),
    ),
  );
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
