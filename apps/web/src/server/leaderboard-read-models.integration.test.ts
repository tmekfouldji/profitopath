import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getPublicLeaderboard,
  listPublicLeaderboardCompetitions,
} from './public-leaderboards';
import { getTraderLeaderboardSummaries } from './trader-leaderboards';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  accountId: string;
  competitionId: string;
  entryId: string;
  tierId: string;
  userId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.leaderboardStanding.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardFinalization.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardScoreInput.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.accountSnapshot.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.tradingAccount.delete({ where: { id: fixture.accountId } });
    await database.competitionEntry.delete({ where: { id: fixture.entryId } });
    await database.competition.delete({ where: { id: fixture.competitionId } });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.delete({ where: { id: fixture.userId } });
  }
});

integrationTest('leaderboard read models', () => {
  it('serves an immutable archive publicly and the exact owner result privately', async () => {
    const suffix = crypto.randomUUID();
    const cutoff = new Date('2026-04-03T21:00:00.000Z');
    const fixture = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          displayName: 'Archive Alias',
          email: `archive-${suffix}@example.test`,
        },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `ARC-${suffix.slice(0, 8)}`,
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: `Archive tier ${suffix.slice(0, 8)}`,
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `ARCHIVE-WEEK-${suffix}`,
          finalizedAt: new Date('2026-04-03T21:01:00.000Z'),
          name: 'Archived Leaderboard Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-03-29T20:00:00.000Z'),
          status: 'ARCHIVED',
          tradingEndsAt: cutoff,
          tradingStartsAt: new Date('2026-03-30T00:00:00.000Z'),
        },
      });
      const entry = await transaction.competitionEntry.create({
        data: {
          activatedAt: new Date('2026-03-29T12:00:00.000Z'),
          completedAt: cutoff,
          competitionId: competition.id,
          status: 'COMPLETED',
          tierId: tier.id,
          userId: user.id,
        },
      });
      const account = await transaction.tradingAccount.create({
        data: {
          balanceMinor: 1_125_000n,
          competitionEntryId: entry.id,
          configVersion: 1,
          realizedPnlMinor: 125_000n,
          startingBalanceMinor: 1_000_000n,
          status: 'COMPLETED',
        },
      });
      const snapshot = await transaction.accountSnapshot.create({
        data: {
          asOf: cutoff,
          balanceMinor: 1_125_000n,
          dataVersion: 1,
          equityMinor: 1_125_000n,
          marginFreeMinor: 1_125_000n,
          marginUsedMinor: 0n,
          maxDrawdownMinor: 30_000n,
          sequence: 1n,
          tradingAccountId: account.id,
          unrealizedPnlMinor: 0n,
        },
      });
      await transaction.leaderboardScoreInput.create({
        data: {
          activatedAt: entry.activatedAt ?? cutoff,
          capturedAt: cutoff,
          competitionId: competition.id,
          cutoffAt: cutoff,
          displayName: 'Archive Alias',
          eligibilityStatus: 'ELIGIBLE',
          entryId: entry.id,
          equityMinor: 1_125_000n,
          finalScoreReachedAt: cutoff,
          maxObservedDrawdownMinor: 30_000n,
          netPerformanceMinor: 125_000n,
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
          finalizedAt: competition.finalizedAt ?? cutoff,
          result: { retained: true },
          resultHash: 'a'.repeat(64),
          rulesVersion: 1,
        },
      });
      await transaction.leaderboardStanding.create({
        data: {
          activatedAt: entry.activatedAt ?? cutoff,
          competitionId: competition.id,
          displayName: 'Archive Alias',
          displayOrder: 1,
          entryId: entry.id,
          equityMinor: 1_125_000n,
          finalScoreReachedAt: cutoff,
          finalizationId: finalization.id,
          isTied: true,
          maxObservedDrawdownMinor: 30_000n,
          netPerformanceMinor: 125_000n,
          policyVersion: 1,
          rank: 1,
          startingBalanceMinor: 1_000_000n,
          tierId: tier.id,
        },
      });
      return {
        accountId: account.id,
        competitionId: competition.id,
        entryId: entry.id,
        tierId: tier.id,
        userId: user.id,
      };
    });
    fixtures.push(fixture);

    const publicView = await getPublicLeaderboard(fixture.competitionId);
    expect(publicView).toMatchObject({
      mode: 'FINAL',
      resultHash: 'a'.repeat(64),
      tiers: [
        {
          standings: [
            {
              displayName: 'Archive Alias',
              isTied: true,
              netPerformanceMinor: 125_000n,
              rank: 1,
            },
          ],
        },
      ],
    });
    expect(publicView?.tiers[0]?.standings[0]).not.toHaveProperty('entryId');
    expect(publicView?.tiers[0]?.standings[0]).not.toHaveProperty('userId');

    const summaries = await getTraderLeaderboardSummaries(fixture.userId);
    expect(summaries.get(fixture.entryId)).toMatchObject({
      competitionStatus: 'ARCHIVED',
      eligible: true,
      eligibility: 'ELIGIBLE',
      isTied: true,
      maxObservedDrawdownMinor: 30_000n,
      netPerformanceMinor: 125_000n,
      rank: 1,
    });
    await expect(listPublicLeaderboardCompetitions()).resolves.toContainEqual(
      expect.objectContaining({
        id: fixture.competitionId,
        status: 'ARCHIVED',
      }),
    );
  });
});
