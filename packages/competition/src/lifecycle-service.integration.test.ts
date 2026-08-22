import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import { processCompetitionLifecycle } from './lifecycle-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  accountId: string;
  competitionId: string;
  entryId: string;
  instrumentSymbol: string;
  tierId: string;
  userId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { correlationId: `competition-activation:${fixture.competitionId}` },
          {
            correlationId: {
              startsWith: `competition-cutoff:${fixture.competitionId}:`,
            },
          },
        ],
      },
    });
    await database.leaderboardScoreInput.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.accountSnapshot.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.order.deleteMany({
      where: { tradingAccountId: fixture.accountId },
    });
    await database.tradingAccount.delete({ where: { id: fixture.accountId } });
    await database.competitionEntry.delete({ where: { id: fixture.entryId } });
    await database.competition.delete({ where: { id: fixture.competitionId } });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.delete({ where: { id: fixture.userId } });
    await database.instrumentConfiguration.delete({
      where: {
        symbol_version: { symbol: fixture.instrumentSymbol, version: 1 },
      },
    });
  }
});

integrationTest('competition lifecycle', () => {
  it('activates, freezes, captures cutoff input, and expires orders exactly once', async () => {
    const suffix = crypto.randomUUID();
    const instrumentSymbol =
      `L${suffix.replaceAll('-', '').slice(0, 12)}`.toUpperCase();
    const fixture = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          displayName: 'Lifecycle Trader',
          email: `lifecycle-${suffix}@example.test`,
        },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `LIFE-${suffix.slice(0, 8)}`,
          entryFeeMinor: 500,
          maxDrawdownMinor: 100_000n,
          name: 'Lifecycle Tier',
          performanceBenchmarkMinor: 200_000n,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `LIFE-WEEK-${suffix}`,
          name: 'Lifecycle Week',
          rulesVersion: 1,
          signupClosesAt: new Date('2026-01-04T23:00:00.000Z'),
          status: 'SCHEDULED',
          tradingEndsAt: new Date('2026-01-09T21:00:00.000Z'),
          tradingStartsAt: new Date('2026-01-05T00:00:00.000Z'),
        },
      });
      const entry = await transaction.competitionEntry.create({
        data: {
          activatedAt: new Date('2026-01-04T10:00:00.000Z'),
          competitionId: competition.id,
          status: 'ACTIVE',
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
          status: 'ACTIVE',
        },
      });
      await transaction.instrumentConfiguration.create({
        data: {
          active: true,
          baseCurrency: 'EUR',
          contractSize: '100000',
          leverage: '100',
          marketHoursMode: 'UTC_24X5',
          minimumQuantity: '0.01',
          priceScale: 5,
          quantityStep: '0.01',
          quoteCurrency: 'USD',
          symbol: instrumentSymbol,
          version: 1,
        },
      });
      await transaction.order.create({
        data: {
          acceptedAt: new Date('2026-01-09T20:00:00.000Z'),
          clientOrderId: `cutoff-${suffix}`,
          instrumentVersion: 1,
          limitPrice: '1.1',
          quantity: '0.1',
          side: 'BUY',
          status: 'ACCEPTED',
          symbol: instrumentSymbol,
          tradingAccountId: account.id,
          type: 'LIMIT',
        },
      });
      await transaction.accountSnapshot.createMany({
        data: [
          {
            asOf: new Date('2026-01-09T20:00:00.000Z'),
            balanceMinor: 1_100_000n,
            dataVersion: 1,
            equityMinor: 1_100_000n,
            marginFreeMinor: 1_050_000n,
            marginUsedMinor: 50_000n,
            maxDrawdownMinor: 50_000n,
            sequence: 1n,
            tradingAccountId: account.id,
            unrealizedPnlMinor: 0n,
          },
          {
            asOf: new Date('2026-01-09T20:59:59.000Z'),
            balanceMinor: 1_100_000n,
            dataVersion: 1,
            equityMinor: 1_100_000n,
            marginFreeMinor: 1_100_000n,
            marginUsedMinor: 0n,
            maxDrawdownMinor: 20_000n,
            sequence: 2n,
            tradingAccountId: account.id,
            unrealizedPnlMinor: 0n,
          },
        ],
      });
      return {
        accountId: account.id,
        competitionId: competition.id,
        entryId: entry.id,
        instrumentSymbol,
        tierId: tier.id,
        userId: user.id,
      };
    });
    fixtures.push(fixture);

    await expect(
      processCompetitionLifecycle(new Date('2026-01-04T23:59:59.999Z')),
    ).resolves.toEqual({
      activatedCompetitions: 0,
      capturedScoreInputs: 0,
      completedAccounts: 0,
      completedEntries: 0,
      expiredOrders: 0,
      frozenCompetitions: 0,
    });
    await expect(
      database.competition.findUniqueOrThrow({
        select: { status: true },
        where: { id: fixture.competitionId },
      }),
    ).resolves.toEqual({ status: 'SCHEDULED' });

    const activated = await processCompetitionLifecycle(
      new Date('2026-01-05T00:00:00.000Z'),
    );
    expect(activated.activatedCompetitions).toBe(1);
    await expect(
      database.competition.findUniqueOrThrow({
        select: { status: true },
        where: { id: fixture.competitionId },
      }),
    ).resolves.toEqual({ status: 'ACTIVE' });

    await expect(
      processCompetitionLifecycle(new Date('2026-01-09T20:59:59.999Z')),
    ).resolves.toEqual({
      activatedCompetitions: 0,
      capturedScoreInputs: 0,
      completedAccounts: 0,
      completedEntries: 0,
      expiredOrders: 0,
      frozenCompetitions: 0,
    });
    const frozen = await processCompetitionLifecycle(
      new Date('2026-01-09T21:00:00.000Z'),
    );
    expect(frozen).toMatchObject({
      capturedScoreInputs: 1,
      completedAccounts: 1,
      completedEntries: 1,
      expiredOrders: 1,
      frozenCompetitions: 1,
    });
    const [competition, entry, account, order, score] = await Promise.all([
      database.competition.findUniqueOrThrow({
        where: { id: fixture.competitionId },
      }),
      database.competitionEntry.findUniqueOrThrow({
        where: { id: fixture.entryId },
      }),
      database.tradingAccount.findUniqueOrThrow({
        where: { id: fixture.accountId },
      }),
      database.order.findFirstOrThrow({
        where: { tradingAccountId: fixture.accountId },
      }),
      database.leaderboardScoreInput.findFirstOrThrow({
        where: { competitionId: fixture.competitionId },
      }),
    ]);
    expect(competition.status).toBe('FROZEN');
    expect(entry.status).toBe('COMPLETED');
    expect(account.status).toBe('COMPLETED');
    expect(order).toMatchObject({
      status: 'EXPIRED',
      terminalReason: 'Competition trading window ended',
    });
    expect(score).toMatchObject({
      displayName: 'Lifecycle Trader',
      eligibilityStatus: 'ELIGIBLE',
      equityMinor: 1_100_000n,
      finalScoreReachedAt: new Date('2026-01-09T20:00:00.000Z'),
      maxObservedDrawdownMinor: 50_000n,
      netPerformanceMinor: 100_000n,
    });

    await expect(
      processCompetitionLifecycle(new Date('2026-01-09T21:05:00.000Z')),
    ).resolves.toEqual({
      activatedCompetitions: 0,
      capturedScoreInputs: 0,
      completedAccounts: 0,
      completedEntries: 0,
      expiredOrders: 0,
      frozenCompetitions: 0,
    });
    await expect(
      database.leaderboardScoreInput.count({
        where: { competitionId: fixture.competitionId },
      }),
    ).resolves.toBe(1);
  });
});
