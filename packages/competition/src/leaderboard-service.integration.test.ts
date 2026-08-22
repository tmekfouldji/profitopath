import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  finalizeLeaderboard,
  recomputeLiveLeaderboard,
} from './leaderboard-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  competitionId: string;
  tierIds: string[];
  userIds: string[];
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    const accounts = await database.tradingAccount.findMany({
      select: { id: true },
      where: { competitionEntry: { competitionId: fixture.competitionId } },
    });
    const accountIds = accounts.map((account) => account.id);
    await database.auditEvent.deleteMany({
      where: { entityId: fixture.competitionId },
    });
    await database.leaderboardStanding.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardFinalization.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardScoreInput.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.ruleBreach.deleteMany({
      where: { tradingAccountId: { in: accountIds } },
    });
    await database.accountSnapshot.deleteMany({
      where: { tradingAccountId: { in: accountIds } },
    });
    await database.tradingAccount.deleteMany({
      where: { id: { in: accountIds } },
    });
    await database.competitionEntry.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.competition.delete({
      where: { id: fixture.competitionId },
    });
    await database.challengeTier.deleteMany({
      where: { id: { in: fixture.tierIds } },
    });
    await database.user.deleteMany({
      where: { id: { in: fixture.userIds } },
    });
  }
});

integrationTest('authoritative leaderboard service', () => {
  it('recomputes live tiers and finalizes one immutable tied result', async () => {
    const suffix = crypto.randomUUID();
    const cutoff = new Date('2026-02-06T21:00:00.000Z');
    const asOf = new Date('2026-02-06T20:00:00.000Z');
    const activatedAt = new Date('2026-02-01T12:00:00.000Z');
    const fixture = await database.$transaction(async (transaction) => {
      const tiers = await Promise.all(
        ['Rookie', 'Trader'].map((name, index) =>
          transaction.challengeTier.create({
            data: {
              code: `LB${index}-${suffix.slice(0, 8)}`,
              entryFeeMinor: 500 + index * 500,
              maxDrawdownMinor: 100_000n,
              name: `${name} ${suffix.slice(0, 8)}`,
              performanceBenchmarkMinor: 200_000n,
              startingBalanceMinor: 1_000_000n,
            },
          }),
        ),
      );
      const competition = await transaction.competition.create({
        data: {
          code: `LEADERBOARD-${suffix}`,
          name: 'Leaderboard Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-02-01T20:00:00.000Z'),
          status: 'ACTIVE',
          tradingEndsAt: cutoff,
          tradingStartsAt: new Date('2026-02-02T00:00:00.000Z'),
        },
      });
      const definitions = [
        { displayName: 'Rookie Alpha', equity: 1_100_000n, tier: 0 },
        { displayName: 'Rookie Beta', equity: 1_100_000n, tier: 0 },
        { displayName: 'Breached Leader', equity: 1_500_000n, tier: 0 },
        { displayName: 'Trader Gamma', equity: 1_050_000n, tier: 1 },
      ] as const;
      const created = [];
      for (const [index, definition] of definitions.entries()) {
        const tier = tiers[definition.tier];
        if (tier === undefined) throw new Error('Missing test tier');
        const user = await transaction.user.create({
          data: {
            displayName: definition.displayName,
            email: `leaderboard-${index}-${suffix}@example.test`,
          },
        });
        const entry = await transaction.competitionEntry.create({
          data: {
            activatedAt,
            competitionId: competition.id,
            status: index === 2 ? 'BREACHED' : 'ACTIVE',
            tierId: tier.id,
            userId: user.id,
          },
        });
        const account = await transaction.tradingAccount.create({
          data: {
            balanceMinor: definition.equity,
            competitionEntryId: entry.id,
            configVersion: 1,
            realizedPnlMinor: definition.equity - 1_000_000n,
            startingBalanceMinor: 1_000_000n,
            status: index === 2 ? 'BREACHED' : 'ACTIVE',
          },
        });
        const snapshot = await transaction.accountSnapshot.create({
          data: {
            asOf,
            balanceMinor: definition.equity,
            dataVersion: 1,
            equityMinor: definition.equity,
            marginFreeMinor: definition.equity,
            marginUsedMinor: 0n,
            maxDrawdownMinor: 25_000n,
            sequence: 1n,
            tradingAccountId: account.id,
            unrealizedPnlMinor: 0n,
          },
        });
        if (index === 2) {
          await transaction.ruleBreach.create({
            data: {
              occurredAt: asOf,
              rulesVersion: 1,
              sourceEventId: `leaderboard-breach-${suffix}`,
              tradingAccountId: account.id,
              type: 'MAX_DRAWDOWN',
            },
          });
        }
        created.push({ account, entry, snapshot, tier, user });
      }
      return {
        competitionId: competition.id,
        created,
        tierIds: tiers.map((tier) => tier.id),
        userIds: created.map(({ user }) => user.id),
      };
    });
    fixtures.push({
      competitionId: fixture.competitionId,
      tierIds: fixture.tierIds,
      userIds: fixture.userIds,
    });

    const live = await recomputeLiveLeaderboard({
      asOf,
      competitionId: fixture.competitionId,
    });
    expect(live.asOf).toBe(asOf.toISOString());
    expect(
      live.standings
        .map(({ displayName, rank }) => [displayName, rank] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ).toEqual([
      ['Rookie Alpha', 1],
      ['Rookie Beta', 1],
      ['Trader Gamma', 1],
    ]);
    await expect(
      finalizeLeaderboard({ competitionId: fixture.competitionId }),
    ).rejects.toThrow('Only a frozen competition can be finalized');

    await database.$transaction(async (transaction) => {
      await transaction.competition.update({
        data: { status: 'FROZEN' },
        where: { id: fixture.competitionId },
      });
      for (const [index, item] of fixture.created.entries()) {
        if (index !== 2) {
          await transaction.competitionEntry.update({
            data: { completedAt: cutoff, status: 'COMPLETED' },
            where: { id: item.entry.id },
          });
          await transaction.tradingAccount.update({
            data: { status: 'COMPLETED' },
            where: { id: item.account.id },
          });
        }
        await transaction.leaderboardScoreInput.create({
          data: {
            activatedAt,
            capturedAt: cutoff,
            competitionId: fixture.competitionId,
            cutoffAt: cutoff,
            displayName: item.user.displayName ?? 'Trader',
            eligibilityStatus: index === 2 ? 'RULE_BREACH' : 'ELIGIBLE',
            entryId: item.entry.id,
            equityMinor: item.snapshot.equityMinor,
            finalScoreReachedAt: asOf,
            maxObservedDrawdownMinor: 25_000n,
            netPerformanceMinor:
              item.snapshot.equityMinor - item.account.startingBalanceMinor,
            policyVersion: 1,
            sourceSnapshotId: item.snapshot.id,
            startingBalanceMinor: item.account.startingBalanceMinor,
            tierId: item.tier.id,
            tradingAccountId: item.account.id,
          },
        });
      }
    });

    const concurrentFinalizations = await Promise.all([
      finalizeLeaderboard({
        competitionId: fixture.competitionId,
        finalizedAt: new Date('2026-02-06T21:01:00.000Z'),
      }),
      finalizeLeaderboard({
        competitionId: fixture.competitionId,
        finalizedAt: new Date('2026-02-06T21:01:00.000Z'),
      }),
    ]);
    expect(
      concurrentFinalizations
        .map(({ alreadyFinalized }) => alreadyFinalized)
        .sort(),
    ).toEqual([false, true]);
    const finalized = concurrentFinalizations.find(
      (result) => !result.alreadyFinalized,
    );
    if (finalized === undefined) throw new Error('Missing first finalization');
    expect(finalized.result.standings).toHaveLength(3);
    const rookieTierId = fixture.created[0]?.tier.id;
    if (rookieTierId === undefined) throw new Error('Missing Rookie test tier');
    expect(
      finalized.result.standings.filter(
        (standing) => standing.tierId === rookieTierId,
      ),
    ).toMatchObject([
      { isTied: true, rank: 1 },
      { isTied: true, rank: 1 },
    ]);

    const replay = await finalizeLeaderboard({
      competitionId: fixture.competitionId,
    });
    expect(replay).toMatchObject({
      alreadyFinalized: true,
      finalizationId: finalized.finalizationId,
      resultHash: finalized.resultHash,
    });
    await expect(
      database.leaderboardFinalization.count({
        where: { competitionId: fixture.competitionId },
      }),
    ).resolves.toBe(1);
    await expect(
      database.leaderboardStanding.count({
        where: { competitionId: fixture.competitionId },
      }),
    ).resolves.toBe(3);
    await expect(
      database.competition.findUniqueOrThrow({
        select: { status: true },
        where: { id: fixture.competitionId },
      }),
    ).resolves.toEqual({ status: 'FINALIZED' });
  });
});
