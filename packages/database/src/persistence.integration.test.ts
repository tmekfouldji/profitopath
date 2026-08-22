import { afterAll, describe, expect, it } from 'vitest';

import { database } from './client';

class RollbackIntegrationTest extends Error {}

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);

integrationTest('PostgreSQL persistence', () => {
  afterAll(async () => {
    await database.$disconnect();
  });

  it('persists an account ledger and audit graph atomically', async () => {
    const suffix = crypto.randomUUID();
    const shortSuffix = suffix.slice(0, 8);

    await expect(
      database.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            displayName: 'Persistence Test',
            email: `persistence-${suffix}@example.test`,
          },
        });
        const tier = await transaction.challengeTier.create({
          data: {
            code: `TEST-${shortSuffix}`,
            entryFeeMinor: 500,
            maxDrawdownMinor: 100_000n,
            name: 'Test Tier',
            performanceBenchmarkMinor: 200_000n,
            startingBalanceMinor: 1_000_000n,
          },
        });
        const competition = await transaction.competition.create({
          data: {
            code: `TEST-${shortSuffix}`,
            name: 'Persistence Test Week',
            rulesVersion: 1,
            signupClosesAt: new Date('2026-08-23T00:00:00.000Z'),
            tradingEndsAt: new Date('2026-08-28T23:59:59.000Z'),
            tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
          },
        });
        const entry = await transaction.competitionEntry.create({
          data: {
            competitionId: competition.id,
            tierId: tier.id,
            userId: user.id,
          },
        });
        const account = await transaction.tradingAccount.create({
          data: {
            balanceMinor: 1_000_000n,
            competitionEntryId: entry.id,
            configVersion: 1,
            startingBalanceMinor: 1_000_000n,
          },
        });
        await transaction.accountBalanceLedgerEntry.create({
          data: {
            amountMinor: 1_000_000n,
            balanceAfterMinor: 1_000_000n,
            idempotencyKey: `initial-${suffix}`,
            occurredAt: new Date('2026-08-24T00:00:00.000Z'),
            tradingAccountId: account.id,
            type: 'INITIAL_BALANCE',
          },
        });
        await transaction.auditEvent.create({
          data: {
            action: 'ACCOUNT_CREATED',
            actorUserId: user.id,
            after: { status: 'PENDING' },
            entityId: account.id,
            entityType: 'TradingAccount',
          },
        });

        const persisted = await transaction.tradingAccount.findUniqueOrThrow({
          include: {
            balanceLedgerEntries: true,
            competitionEntry: {
              include: { competition: true, tier: true, user: true },
            },
          },
          where: { id: account.id },
        });

        expect(persisted.balanceMinor).toBe(1_000_000n);
        expect(persisted.balanceLedgerEntries).toHaveLength(1);
        expect(persisted.competitionEntry.user.email).toContain(suffix);
        expect(persisted.competitionEntry.competition.rulesVersion).toBe(1);
        throw new RollbackIntegrationTest(
          'rollback successful integration assertions',
        );
      }),
    ).rejects.toThrow(RollbackIntegrationTest);
  });

  it('loads the three idempotently seeded competition tiers', async () => {
    const tiers = await database.challengeTier.findMany({
      orderBy: { entryFeeMinor: 'asc' },
      where: { code: { in: ['ROOKIE', 'TRADER', 'ELITE'] } },
    });

    expect(tiers.map((tier) => [tier.code, tier.entryFeeMinor])).toEqual([
      ['ROOKIE', 500],
      ['TRADER', 1_000],
      ['ELITE', 1_500],
    ]);
  });
});
