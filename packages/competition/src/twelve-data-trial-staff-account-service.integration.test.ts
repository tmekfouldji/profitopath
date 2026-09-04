import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  provisionTwelveDataTrialStaffAccount,
  TwelveDataTrialStaffAccountError,
} from './twelve-data-trial-staff-account-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  competitionId: string;
  sourceEntryId: string;
  sourceTierId: string;
  staffUserId: string;
  traderId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    const staffEntries = await database.competitionEntry.findMany({
      include: { tradingAccount: true },
      where: {
        competitionId: fixture.competitionId,
        userId: fixture.staffUserId,
      },
    });
    const accountIds = staffEntries.flatMap((entry) =>
      entry.tradingAccount === null ? [] : [entry.tradingAccount.id],
    );
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { actorUserId: fixture.staffUserId },
          ...staffEntries.map((entry) => ({ entityId: entry.id })),
          ...accountIds.map((id) => ({ entityId: id })),
        ],
      },
    });
    if (accountIds.length > 0) {
      await database.accountBalanceLedgerEntry.deleteMany({
        where: { tradingAccountId: { in: accountIds } },
      });
      await database.tradingAccount.deleteMany({
        where: { id: { in: accountIds } },
      });
    }
    await database.competitionEntry.deleteMany({
      where: { id: { in: staffEntries.map((entry) => entry.id) } },
    });
    await database.competitionEntry.delete({
      where: { id: fixture.sourceEntryId },
    });
    await database.competition.delete({ where: { id: fixture.competitionId } });
    await database.challengeTier.delete({
      where: { id: fixture.sourceTierId },
    });
    const staffTier = await database.challengeTier.findUnique({
      select: { id: true },
      where: { code: 'TD-STAFF-202609' },
    });
    if (staffTier !== null) {
      const remainingStaffEntries = await database.competitionEntry.count({
        where: { tierId: staffTier.id },
      });
      if (remainingStaffEntries === 0) {
        await database.auditEvent.deleteMany({
          where: { entityId: staffTier.id },
        });
        await database.challengeTier.delete({ where: { id: staffTier.id } });
      }
    }
    await database.user.delete({ where: { id: fixture.staffUserId } });
    await database.user.delete({ where: { id: fixture.traderId } });
  }
});

integrationTest('Twelve Data trial staff account service', () => {
  it('creates an inactive, zero-fee internal tier and an auditable active account exactly once', async () => {
    const suffix = crypto.randomUUID();
    const now = new Date('2026-09-04T12:00:00.000Z');
    const fixture = await database.$transaction(async (transaction) => {
      const staff = await transaction.user.create({
        data: {
          email: `trial-staff-${suffix}@example.test`,
          role: 'SUPERADMIN',
        },
      });
      const trader = await transaction.user.create({
        data: { email: `trial-trader-${suffix}@example.test` },
      });
      const tier = await transaction.challengeTier.create({
        data: {
          code: `TRIAL-SOURCE-${suffix.slice(0, 8)}`,
          entryFeeMinor: 700,
          maxDrawdownMinor: 100_000n,
          name: 'Source tier',
          performanceBenchmarkMinor: 50_000n,
          rulesVersion: 7,
          startingBalanceMinor: 1_000_000n,
        },
      });
      const competition = await transaction.competition.create({
        data: {
          code: `TD-STAFF-${suffix}`,
          name: 'Staff validation',
          rulesVersion: 7,
          signupClosesAt: new Date('2026-09-05T00:00:00.000Z'),
          status: 'ACTIVE',
          tradingEndsAt: new Date('2026-09-05T00:00:00.000Z'),
          tradingStartsAt: new Date('2026-09-04T00:00:00.000Z'),
        },
      });
      const sourceEntry = await transaction.competitionEntry.create({
        data: {
          activatedAt: now,
          competitionId: competition.id,
          status: 'ACTIVE',
          tierId: tier.id,
          userId: trader.id,
        },
      });
      return {
        competitionId: competition.id,
        sourceEntryId: sourceEntry.id,
        sourceTierId: tier.id,
        staffUserId: staff.id,
        traderId: trader.id,
      };
    });
    fixtures.push(fixture);

    const first = await provisionTwelveDataTrialStaffAccount({
      actorUserId: fixture.staffUserId,
      competitionId: fixture.competitionId,
      now,
    });
    const second = await provisionTwelveDataTrialStaffAccount({
      actorUserId: fixture.staffUserId,
      competitionId: fixture.competitionId,
      now,
    });

    expect(first.alreadyProvisioned).toBe(false);
    expect(second).toMatchObject({
      accountId: first.accountId,
      alreadyProvisioned: true,
      competitionId: fixture.competitionId,
      entryId: first.entryId,
      tierId: first.tierId,
    });

    const [tier, entry, account, ledger, audits] = await Promise.all([
      database.challengeTier.findUniqueOrThrow({ where: { id: first.tierId } }),
      database.competitionEntry.findUniqueOrThrow({
        where: { id: first.entryId },
      }),
      database.tradingAccount.findUniqueOrThrow({
        where: { id: first.accountId },
      }),
      database.accountBalanceLedgerEntry.findMany({
        where: { tradingAccountId: first.accountId },
      }),
      database.auditEvent.findMany({
        where: { correlationId: `staff-twelve-data:${fixture.competitionId}` },
      }),
    ]);
    expect(tier).toMatchObject({
      active: false,
      code: 'TD-STAFF-202609',
      entryFeeMinor: 0,
      rulesVersion: 7,
      startingBalanceMinor: 1_000_000n,
    });
    expect(entry).toMatchObject({
      competitionId: fixture.competitionId,
      status: 'ACTIVE',
      tierId: tier.id,
      userId: fixture.staffUserId,
    });
    expect(account).toMatchObject({
      balanceMinor: 1_000_000n,
      competitionEntryId: entry.id,
      configVersion: 7,
      status: 'ACTIVE',
    });
    expect(ledger).toEqual([
      expect.objectContaining({
        amountMinor: 1_000_000n,
        balanceAfterMinor: 1_000_000n,
        referenceType: 'INTERNAL_STAFF_TRIAL',
        type: 'INITIAL_BALANCE',
      }),
    ]);
    expect(audits.map((audit) => audit.action).sort()).toEqual([
      'STAFF_TRIAL_ACCOUNT_PROVISIONED',
      'STAFF_TRIAL_ENTRY_PROVISIONED',
      'STAFF_TRIAL_TIER_CREATED',
    ]);
  });

  it('rejects an expired staff-validation request before writing', async () => {
    await expect(
      provisionTwelveDataTrialStaffAccount({
        actorUserId: crypto.randomUUID(),
        now: new Date('2026-09-13T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(TwelveDataTrialStaffAccountError);
  });
});
