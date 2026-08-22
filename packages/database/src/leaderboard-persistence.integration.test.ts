import { describe, expect, it } from 'vitest';

import { database } from './client';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);

integrationTest('leaderboard persistence', () => {
  it('retains immutable cutoff input identity and ordered tied final standings', async () => {
    const suffix = crypto.randomUUID();
    const fixture = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email: `leaderboard-${suffix}@example.test` },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `LB-${suffix}`,
          currency: 'USD',
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: 'Leaderboard Test',
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `LB-WEEK-${suffix}`,
          name: 'Leaderboard Test Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-08-23T23:00:00.000Z'),
          status: 'FROZEN',
          tradingEndsAt: new Date('2026-08-28T21:00:00.000Z'),
          tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
        },
      });
      const entry = await transaction.competitionEntry.create({
        data: {
          activatedAt: new Date('2026-08-20T10:00:00.000Z'),
          completedAt: new Date('2026-08-28T21:00:00.000Z'),
          competitionId: competition.id,
          status: 'COMPLETED',
          tierId: tier.id,
          userId: user.id,
        },
      });
      const account = await transaction.tradingAccount.create({
        data: {
          balanceMinor: 1_100_000n,
          competitionEntryId: entry.id,
          configVersion: 1,
          realizedPnlMinor: 100_000n,
          startingBalanceMinor: 1_000_000n,
          status: 'COMPLETED',
        },
      });
      const snapshot = await transaction.accountSnapshot.create({
        data: {
          asOf: new Date('2026-08-28T20:59:59.000Z'),
          balanceMinor: 1_100_000n,
          dataVersion: 1,
          equityMinor: 1_100_000n,
          marginFreeMinor: 1_100_000n,
          marginUsedMinor: 0n,
          maxDrawdownMinor: 25_000n,
          sequence: 1n,
          tradingAccountId: account.id,
          unrealizedPnlMinor: 0n,
        },
      });
      const score = await transaction.leaderboardScoreInput.create({
        data: {
          activatedAt: entry.activatedAt!,
          capturedAt: new Date('2026-08-28T21:00:01.000Z'),
          competitionId: competition.id,
          cutoffAt: competition.tradingEndsAt,
          displayName: 'Trader Test',
          eligibilityStatus: 'ELIGIBLE',
          entryId: entry.id,
          equityMinor: 1_100_000n,
          finalScoreReachedAt: snapshot.asOf,
          maxObservedDrawdownMinor: 25_000n,
          netPerformanceMinor: 100_000n,
          policyVersion: 1,
          sourceSnapshotId: snapshot.id,
          startingBalanceMinor: 1_000_000n,
          tierId: tier.id,
          tradingAccountId: account.id,
        },
      });
      const finalization = await transaction.leaderboardFinalization.create({
        data: {
          competitionId: competition.id,
          finalizedAt: new Date('2026-08-28T21:05:00.000Z'),
          result: { policyVersion: 1, standings: [entry.id] },
          resultHash: 'a'.repeat(64),
          rulesVersion: 1,
        },
      });
      const standing = await transaction.leaderboardStanding.create({
        data: {
          activatedAt: entry.activatedAt!,
          competitionId: competition.id,
          displayName: score.displayName,
          displayOrder: 1,
          entryId: entry.id,
          equityMinor: score.equityMinor,
          finalScoreReachedAt: score.finalScoreReachedAt,
          finalizationId: finalization.id,
          isTied: true,
          maxObservedDrawdownMinor: score.maxObservedDrawdownMinor,
          netPerformanceMinor: score.netPerformanceMinor,
          policyVersion: score.policyVersion,
          rank: 1,
          startingBalanceMinor: score.startingBalanceMinor,
          tierId: tier.id,
        },
      });
      return {
        account,
        competition,
        entry,
        finalization,
        score,
        standing,
        tier,
        user,
      };
    });

    try {
      const stored = await database.leaderboardFinalization.findUniqueOrThrow({
        include: {
          competition: true,
          standings: { orderBy: { displayOrder: 'asc' } },
        },
        where: { id: fixture.finalization.id },
      });
      expect(stored.standings).toHaveLength(1);
      expect(stored.standings[0]).toMatchObject({
        displayOrder: 1,
        isTied: true,
        rank: 1,
      });
      await expect(
        database.leaderboardScoreInput.create({
          data: {
            activatedAt: fixture.score.activatedAt,
            capturedAt: fixture.score.capturedAt,
            competitionId: fixture.competition.id,
            cutoffAt: fixture.score.cutoffAt,
            displayName: fixture.score.displayName,
            eligibilityStatus: 'ELIGIBLE',
            entryId: fixture.entry.id,
            equityMinor: 1_200_000n,
            finalScoreReachedAt: fixture.score.finalScoreReachedAt,
            maxObservedDrawdownMinor: 25_000n,
            netPerformanceMinor: 200_000n,
            policyVersion: 1,
            startingBalanceMinor: 1_000_000n,
            tierId: fixture.tier.id,
            tradingAccountId: fixture.account.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        database.leaderboardStanding.create({
          data: {
            activatedAt: fixture.standing.activatedAt,
            competitionId: fixture.competition.id,
            displayName: 'Conflicting duplicate',
            displayOrder: 2,
            entryId: fixture.entry.id,
            equityMinor: fixture.standing.equityMinor,
            finalScoreReachedAt: fixture.standing.finalScoreReachedAt,
            finalizationId: fixture.finalization.id,
            maxObservedDrawdownMinor: fixture.standing.maxObservedDrawdownMinor,
            netPerformanceMinor: fixture.standing.netPerformanceMinor,
            policyVersion: 1,
            rank: 1,
            startingBalanceMinor: fixture.standing.startingBalanceMinor,
            tierId: fixture.tier.id,
          },
        }),
      ).rejects.toThrow();
    } finally {
      await database.$transaction([
        database.leaderboardStanding.deleteMany({
          where: { finalizationId: fixture.finalization.id },
        }),
        database.leaderboardFinalization.deleteMany({
          where: { id: fixture.finalization.id },
        }),
        database.leaderboardScoreInput.deleteMany({
          where: { competitionId: fixture.competition.id },
        }),
        database.accountSnapshot.deleteMany({
          where: { tradingAccountId: fixture.account.id },
        }),
        database.tradingAccount.deleteMany({
          where: { id: fixture.account.id },
        }),
        database.competitionEntry.deleteMany({
          where: { id: fixture.entry.id },
        }),
        database.competition.deleteMany({
          where: { id: fixture.competition.id },
        }),
        database.challengeTier.deleteMany({ where: { id: fixture.tier.id } }),
        database.user.deleteMany({ where: { id: fixture.user.id } }),
      ]);
    }
  });
});
