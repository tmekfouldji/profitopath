import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  archiveCompetition,
  disqualifyCompetitionEntry,
} from './admin-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  adminId: string;
  competitionId: string;
  entryId: string;
  tierId: string;
  traderId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    const account = await database.tradingAccount.findUnique({
      where: { competitionEntryId: fixture.entryId },
    });
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { actorUserId: fixture.adminId },
          { entityId: fixture.competitionId },
          { entityId: fixture.entryId },
          ...(account === null ? [] : [{ entityId: account.id }]),
        ],
      },
    });
    await database.leaderboardScoreInput.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    if (account !== null) {
      await database.accountSnapshot.deleteMany({
        where: { tradingAccountId: account.id },
      });
      await database.tradingAccount.delete({ where: { id: account.id } });
    }
    await database.competitionEntry.delete({ where: { id: fixture.entryId } });
    await database.competition.delete({
      where: { id: fixture.competitionId },
    });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.deleteMany({
      where: { id: { in: [fixture.adminId, fixture.traderId] } },
    });
  }
});

integrationTest('competition admin service', () => {
  it('serializes disqualification, updates cutoff eligibility, audits, and archives', async () => {
    const suffix = crypto.randomUUID();
    const fixture = await database.$transaction(async (transaction) => {
      const admin = await transaction.user.create({
        data: {
          email: `admin-${suffix}@example.test`,
          role: 'ADMIN',
        },
      });
      const trader = await transaction.user.create({
        data: {
          displayName: 'Reviewed Trader',
          email: `trader-${suffix}@example.test`,
        },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `ADM-${suffix.slice(0, 8)}`,
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: `Admin test ${suffix.slice(0, 8)}`,
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `ADMIN-WEEK-${suffix}`,
          name: 'Admin Review Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-03-01T20:00:00.000Z'),
          status: 'FROZEN',
          tradingEndsAt: new Date('2026-03-06T21:00:00.000Z'),
          tradingStartsAt: new Date('2026-03-02T00:00:00.000Z'),
        },
      });
      const entry = await transaction.competitionEntry.create({
        data: {
          activatedAt: new Date('2026-03-01T12:00:00.000Z'),
          completedAt: new Date('2026-03-06T21:00:00.000Z'),
          competitionId: competition.id,
          status: 'COMPLETED',
          tierId: tier.id,
          userId: trader.id,
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
          asOf: competition.tradingEndsAt,
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
      await transaction.leaderboardScoreInput.create({
        data: {
          activatedAt: entry.activatedAt ?? competition.tradingStartsAt,
          capturedAt: competition.tradingEndsAt,
          competitionId: competition.id,
          cutoffAt: competition.tradingEndsAt,
          displayName: 'Reviewed Trader',
          eligibilityStatus: 'ELIGIBLE',
          entryId: entry.id,
          equityMinor: 1_100_000n,
          finalScoreReachedAt: competition.tradingEndsAt,
          maxObservedDrawdownMinor: 25_000n,
          netPerformanceMinor: 100_000n,
          policyVersion: 1,
          sourceSnapshotId: snapshot.id,
          startingBalanceMinor: 1_000_000n,
          tierId: tier.id,
          tradingAccountId: account.id,
        },
      });
      return {
        adminId: admin.id,
        competitionId: competition.id,
        entryId: entry.id,
        tierId: tier.id,
        traderId: trader.id,
      };
    });
    fixtures.push(fixture);

    await expect(
      archiveCompetition({
        actorUserId: fixture.adminId,
        competitionId: fixture.competitionId,
        reason: 'Attempted before result finalization',
      }),
    ).rejects.toThrow('Invalid Competition state transition');

    const results = await Promise.all([
      disqualifyCompetitionEntry({
        actorUserId: fixture.adminId,
        entryId: fixture.entryId,
        reason: 'Manual review confirmed prohibited conduct',
      }),
      disqualifyCompetitionEntry({
        actorUserId: fixture.adminId,
        entryId: fixture.entryId,
        reason: 'Manual review confirmed prohibited conduct',
      }),
    ]);
    expect(results).toContainEqual({
      alreadyDisqualified: false,
      cancelledOrders: 0,
    });
    expect(results).toContainEqual({
      alreadyDisqualified: true,
      cancelledOrders: 0,
    });
    const [entry, account, score, auditCount] = await Promise.all([
      database.competitionEntry.findUniqueOrThrow({
        where: { id: fixture.entryId },
      }),
      database.tradingAccount.findUniqueOrThrow({
        where: { competitionEntryId: fixture.entryId },
      }),
      database.leaderboardScoreInput.findFirstOrThrow({
        where: { entryId: fixture.entryId },
      }),
      database.auditEvent.count({
        where: {
          action: { in: ['ENTRY_DISQUALIFIED', 'ACCOUNT_DISQUALIFIED'] },
          actorUserId: fixture.adminId,
        },
      }),
    ]);
    expect(entry.status).toBe('DISQUALIFIED');
    expect(account.status).toBe('DISQUALIFIED');
    expect(score.eligibilityStatus).toBe('DISQUALIFIED');
    expect(auditCount).toBe(2);

    await database.competition.update({
      data: { status: 'FINALIZED' },
      where: { id: fixture.competitionId },
    });
    await expect(
      archiveCompetition({
        actorUserId: fixture.adminId,
        competitionId: fixture.competitionId,
        reason: 'Review and result retention complete',
      }),
    ).resolves.toEqual({ alreadyArchived: false });
    await expect(
      database.competition.findUniqueOrThrow({
        select: { status: true },
        where: { id: fixture.competitionId },
      }),
    ).resolves.toEqual({ status: 'ARCHIVED' });
  });
});
