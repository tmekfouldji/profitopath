import { parseSeedEnv } from '@profitopath/shared';

import { database } from '../src/client';
import { createDevelopmentCompetitionSeed } from './competition-seed';
import { createDevelopmentInstrumentSeeds } from './instrument-seeds';
import { createTierSeeds } from './tier-seeds';

async function seed(): Promise<void> {
  const tiers = createTierSeeds(parseSeedEnv());
  const instruments = createDevelopmentInstrumentSeeds();

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

  await database.$transaction(
    instruments.map((instrument) =>
      database.instrumentConfiguration.upsert({
        create: instrument,
        update: instrument,
        where: {
          symbol_version: {
            symbol: instrument.symbol,
            version: instrument.version,
          },
        },
      }),
    ),
  );

  const competition = createDevelopmentCompetitionSeed(new Date());
  await database.competition.upsert({
    create: competition,
    update: {
      name: competition.name,
      rulesVersion: competition.rulesVersion,
      signupClosesAt: competition.signupClosesAt,
      status: competition.status,
      timezone: competition.timezone,
      tradingEndsAt: competition.tradingEndsAt,
      tradingStartsAt: competition.tradingStartsAt,
    },
    where: { code: competition.code },
  });
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
