import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import { getTraderPrizeOverview } from './queries';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  competitionId: string;
  tierId: string;
  userIds: string[];
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    const prizes = await database.prize.findMany({
      select: { id: true },
      where: { competitionId: fixture.competitionId },
    });
    await database.freeEntryCredit.deleteMany({
      where: { sourcePrizeId: { in: prizes.map((prize) => prize.id) } },
    });
    await database.prize.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.competitionEntry.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.competition.delete({
      where: { id: fixture.competitionId },
    });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.deleteMany({ where: { id: { in: fixture.userIds } } });
  }
});

integrationTest('trader prize read model', () => {
  it('returns only prizes and access credits owned by the authenticated trader', async () => {
    const suffix = crypto.randomUUID();
    const fixture = await database.$transaction(async (transaction) => {
      const traders = await Promise.all(
        [1, 2].map((index) =>
          transaction.user.create({
            data: { email: `prize-read-${index}-${suffix}@example.test` },
          }),
        ),
      );
      const tier = await transaction.challengeTier.create({
        data: {
          code: `PRD-${suffix.slice(0, 8)}`,
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: `Prize read ${suffix.slice(0, 8)}`,
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `PRIZE-READ-${suffix}`,
          name: 'Prize Read Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-04-05T20:00:00.000Z'),
          status: 'FINALIZED',
          tradingEndsAt: new Date('2026-04-10T21:00:00.000Z'),
          tradingStartsAt: new Date('2026-04-06T00:00:00.000Z'),
        },
      });
      const entries = await Promise.all(
        traders.map((trader) =>
          transaction.competitionEntry.create({
            data: {
              competitionId: competition.id,
              status: 'COMPLETED',
              tierId: tier.id,
              userId: trader?.id ?? '',
            },
          }),
        ),
      );
      const prizes = await Promise.all(
        entries.map((entry, index) =>
          transaction.prize.create({
            data: {
              amountMinor: 1000 - index * 100,
              competitionId: competition.id,
              rank: index + 1,
              status: 'PAID',
              tierId: tier.id,
              winnerEntryId: entry.id,
              winnerReviewStatus: 'CONFIRMED',
            },
          }),
        ),
      );
      await transaction.freeEntryCredit.create({
        data: {
          ordinal: 1,
          sourcePrizeId: prizes[0]?.id ?? '',
          userId: traders[0]?.id ?? '',
        },
      });
      return { competition, prizes, tier, traders };
    });
    fixtures.push({
      competitionId: fixture.competition.id,
      tierId: fixture.tier.id,
      userIds: fixture.traders.map((trader) => trader.id),
    });

    const result = await getTraderPrizeOverview(fixture.traders[0]?.id ?? '');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: fixture.prizes[0]?.id,
      issuedFreeEntryCredits: [{ ordinal: 1, status: 'AVAILABLE' }],
    });
    expect(result.some((prize) => prize.id === fixture.prizes[1]?.id)).toBe(
      false,
    );
  });
});
