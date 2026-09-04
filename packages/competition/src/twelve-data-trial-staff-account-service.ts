import { database, type Prisma } from '@profitopath/database';

const twelveDataTrialCutoff = new Date('2026-09-13T00:00:00.000Z');
const staffTierCode = 'TD-STAFF-202609';

export class TwelveDataTrialStaffAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwelveDataTrialStaffAccountError';
  }
}

interface ProvisionedStaffTrialAccount {
  accountId: string;
  alreadyProvisioned: boolean;
  competitionId: string;
  entryId: string;
  tierId: string;
}

function assertTrialWindow(now: Date): void {
  if (Number.isNaN(now.getTime()) || now >= twelveDataTrialCutoff) {
    throw new TwelveDataTrialStaffAccountError(
      'The Twelve Data staff-validation window is closed',
    );
  }
}

async function recordOnce(
  transaction: Prisma.TransactionClient,
  input: Prisma.AuditEventUncheckedCreateInput & { idempotencyKey: string },
): Promise<void> {
  await transaction.auditEvent.upsert({
    create: input,
    update: {},
    where: { idempotencyKey: input.idempotencyKey },
  });
}

export async function provisionTwelveDataTrialStaffAccount(input: {
  actorUserId: string;
  competitionId?: string;
  now?: Date;
}): Promise<ProvisionedStaffTrialAccount> {
  const now = input.now ?? new Date();
  assertTrialWindow(now);

  return database.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      select: { id: true, role: true, status: true },
      where: { id: input.actorUserId },
    });
    if (
      user === null ||
      user.status !== 'ACTIVE' ||
      (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')
    ) {
      throw new TwelveDataTrialStaffAccountError(
        'Only an active staff user can receive a trial validation account',
      );
    }

    const competitions = await transaction.competition.findMany({
      select: { id: true },
      where: {
        ...(input.competitionId === undefined
          ? {}
          : { id: input.competitionId }),
        status: 'ACTIVE',
        tradingEndsAt: { gt: now },
        tradingStartsAt: { lte: now },
      },
    });
    if (competitions.length !== 1) {
      throw new TwelveDataTrialStaffAccountError(
        'Exactly one active competition is required for staff validation',
      );
    }
    const competition = competitions[0]!;

    const sourceEntry = await transaction.competitionEntry.findFirst({
      include: { tier: true },
      orderBy: { createdAt: 'asc' },
      where: {
        competitionId: competition.id,
        tier: { active: true },
      },
    });
    if (sourceEntry === null) {
      throw new TwelveDataTrialStaffAccountError(
        'The active competition has no active tier to mirror for validation',
      );
    }

    const staffTier = await transaction.challengeTier.upsert({
      create: {
        active: false,
        code: staffTierCode,
        currency: sourceEntry.tier.currency,
        entryFeeMinor: 0,
        maxDrawdownMinor: sourceEntry.tier.maxDrawdownMinor,
        name: 'Internal market-data validation',
        performanceBenchmarkMinor: sourceEntry.tier.performanceBenchmarkMinor,
        rulesVersion: sourceEntry.tier.rulesVersion,
        startingBalanceMinor: sourceEntry.tier.startingBalanceMinor,
      },
      update: {},
      where: { code: staffTierCode },
    });
    if (
      staffTier.active ||
      staffTier.entryFeeMinor !== 0 ||
      staffTier.currency !== sourceEntry.tier.currency ||
      staffTier.maxDrawdownMinor !== sourceEntry.tier.maxDrawdownMinor ||
      staffTier.performanceBenchmarkMinor !==
        sourceEntry.tier.performanceBenchmarkMinor ||
      staffTier.rulesVersion !== sourceEntry.tier.rulesVersion ||
      staffTier.startingBalanceMinor !== sourceEntry.tier.startingBalanceMinor
    ) {
      throw new TwelveDataTrialStaffAccountError(
        'The reserved staff-validation tier has an unsafe configuration',
      );
    }

    const entry = await transaction.competitionEntry.upsert({
      create: {
        activatedAt: now,
        competitionId: competition.id,
        status: 'ACTIVE',
        tierId: staffTier.id,
        userId: user.id,
      },
      update: {},
      where: {
        userId_competitionId_tierId: {
          competitionId: competition.id,
          tierId: staffTier.id,
          userId: user.id,
        },
      },
    });
    if (entry.status !== 'ACTIVE') {
      throw new TwelveDataTrialStaffAccountError(
        'The staff-validation entry is not active',
      );
    }

    const existingAccount = await transaction.tradingAccount.findUnique({
      where: { competitionEntryId: entry.id },
    });
    if (existingAccount !== null && existingAccount.status !== 'ACTIVE') {
      throw new TwelveDataTrialStaffAccountError(
        'The staff-validation trading account is not active',
      );
    }
    const account =
      existingAccount ??
      (await transaction.tradingAccount.create({
        data: {
          balanceMinor: staffTier.startingBalanceMinor,
          competitionEntryId: entry.id,
          configVersion: staffTier.rulesVersion,
          currency: staffTier.currency,
          startingBalanceMinor: staffTier.startingBalanceMinor,
          status: 'ACTIVE',
        },
      }));

    await transaction.accountBalanceLedgerEntry.upsert({
      create: {
        amountMinor: account.startingBalanceMinor,
        balanceAfterMinor: account.startingBalanceMinor,
        idempotencyKey: `initial-balance:staff-twelve-data:${entry.id}`,
        occurredAt: now,
        referenceId: entry.id,
        referenceType: 'INTERNAL_STAFF_TRIAL',
        tradingAccountId: account.id,
        type: 'INITIAL_BALANCE',
      },
      update: {},
      where: {
        idempotencyKey: `initial-balance:staff-twelve-data:${entry.id}`,
      },
    });
    await Promise.all([
      recordOnce(transaction, {
        action: 'STAFF_TRIAL_TIER_CREATED',
        actorUserId: user.id,
        after: {
          code: staffTier.code,
          entryFeeMinor: staffTier.entryFeeMinor,
          sourceTierCode: sourceEntry.tier.code,
        },
        correlationId: `staff-twelve-data:${competition.id}`,
        entityId: staffTier.id,
        entityType: 'ChallengeTier',
        idempotencyKey: `audit:staff-twelve-data-tier:${staffTier.id}`,
        reason:
          'Reserved inactive zero-fee tier for temporary internal market-data validation',
      }),
      recordOnce(transaction, {
        action: 'STAFF_TRIAL_ENTRY_PROVISIONED',
        actorUserId: user.id,
        after: {
          activatedAt: entry.activatedAt?.toISOString(),
          status: entry.status,
        },
        correlationId: `staff-twelve-data:${competition.id}`,
        entityId: entry.id,
        entityType: 'CompetitionEntry',
        idempotencyKey: `audit:staff-twelve-data-entry:${entry.id}`,
        reason:
          'Complimentary internal staff entry; no payment, invoice, or revenue',
      }),
      recordOnce(transaction, {
        action: 'STAFF_TRIAL_ACCOUNT_PROVISIONED',
        actorUserId: user.id,
        after: {
          balanceMinor: account.balanceMinor.toString(),
          configVersion: account.configVersion,
          status: account.status,
        },
        correlationId: `staff-twelve-data:${competition.id}`,
        entityId: account.id,
        entityType: 'TradingAccount',
        idempotencyKey: `audit:staff-twelve-data-account:${account.id}`,
        reason:
          'Server-owned simulated account for temporary internal market-data validation',
      }),
    ]);

    return {
      accountId: account.id,
      alreadyProvisioned: existingAccount !== null,
      competitionId: competition.id,
      entryId: entry.id,
      tierId: staffTier.id,
    };
  });
}
