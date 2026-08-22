import {
  database,
  type LeaderboardEligibilityStatus,
  type Prisma,
} from '@profitopath/database';

import { DEVELOPMENT_LEADERBOARD_POLICY_VERSION } from './leaderboard';
import {
  assertStateTransition,
  competitionEntryTransitions,
  competitionTransitions,
  orderTransitions,
  tradingAccountTransitions,
} from './state-machine';

interface CutoffSnapshotRow {
  equityMinor: bigint;
  finalScoreReachedAt: Date;
  maxObservedDrawdownMinor: bigint;
  sourceSnapshotId: string | null;
  tradingAccountId: string;
}

export interface CompetitionLifecycleResult {
  activatedCompetitions: number;
  capturedScoreInputs: number;
  completedAccounts: number;
  completedEntries: number;
  expiredOrders: number;
  frozenCompetitions: number;
}

export interface CompetitionLifecycleContext {
  actorUserId?: string;
}

function auditActor(actorUserId: string | undefined): {
  actorUserId?: string;
} {
  return actorUserId === undefined ? {} : { actorUserId };
}

function emptyResult(): CompetitionLifecycleResult {
  return {
    activatedCompetitions: 0,
    capturedScoreInputs: 0,
    completedAccounts: 0,
    completedEntries: 0,
    expiredOrders: 0,
    frozenCompetitions: 0,
  };
}

function displayName(input: {
  id: string;
  user: { displayName: string | null; name: string | null };
}): string {
  return (
    input.user.displayName?.trim() ||
    input.user.name?.trim() ||
    `Trader-${input.id.slice(0, 8)}`
  );
}

function eligibilityStatus(input: {
  accountStatus: string;
  entryStatus: string;
  hasRuleBreach: boolean;
  isDisqualified: boolean;
  sourceSnapshotId: string | null;
}): LeaderboardEligibilityStatus {
  if (input.isDisqualified) return 'DISQUALIFIED';
  if (
    input.hasRuleBreach ||
    input.accountStatus === 'BREACHED' ||
    input.entryStatus === 'BREACHED'
  ) {
    return 'RULE_BREACH';
  }
  if (!['ACTIVE', 'COMPLETED'].includes(input.entryStatus)) {
    return 'ENTRY_STATUS';
  }
  if (!['ACTIVE', 'COMPLETED'].includes(input.accountStatus)) {
    return 'ACCOUNT_STATUS';
  }
  return input.sourceSnapshotId === null ? 'MISSING_SNAPSHOT' : 'ELIGIBLE';
}

async function lockCompetition(
  transaction: Prisma.TransactionClient,
  competitionId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`competition-lifecycle:${competitionId}`}, 0)
    )
  `;
}

async function lockTradingAccount(
  transaction: Prisma.TransactionClient,
  accountId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`simulator:${accountId}`}, 0))
  `;
}

async function cutoffSnapshots(
  transaction: Prisma.TransactionClient,
  competitionId: string,
  cutoffAt: Date,
): Promise<Map<string, CutoffSnapshotRow>> {
  const rows = await transaction.$queryRaw<CutoffSnapshotRow[]>`
    SELECT
      account.id AS "tradingAccountId",
      latest.id AS "sourceSnapshotId",
      COALESCE(latest."equityMinor", account."balanceMinor") AS "equityMinor",
      COALESCE((
        SELECT MAX(history."maxDrawdownMinor")
        FROM "AccountSnapshot" history
        WHERE history."tradingAccountId" = account.id
          AND history."asOf" <= ${cutoffAt}
      ), 0) AS "maxObservedDrawdownMinor",
      COALESCE((
        SELECT MIN(score."asOf")
        FROM "AccountSnapshot" score
        WHERE score."tradingAccountId" = account.id
          AND score."asOf" <= ${cutoffAt}
          AND score."equityMinor" = latest."equityMinor"
      ), ${cutoffAt}) AS "finalScoreReachedAt"
    FROM "TradingAccount" account
    INNER JOIN "CompetitionEntry" entry
      ON entry.id = account."competitionEntryId"
    LEFT JOIN LATERAL (
      SELECT snapshot.id, snapshot."equityMinor"
      FROM "AccountSnapshot" snapshot
      WHERE snapshot."tradingAccountId" = account.id
        AND snapshot."asOf" <= ${cutoffAt}
      ORDER BY snapshot."asOf" DESC, snapshot.sequence DESC
      LIMIT 1
    ) latest ON true
    WHERE entry."competitionId" = ${competitionId}::uuid
  `;
  return new Map(rows.map((row) => [row.tradingAccountId, row]));
}

async function activateCompetition(
  competitionId: string,
  now: Date,
  actorUserId?: string,
): Promise<boolean> {
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      where: { id: competitionId },
    });
    if (
      competition.status !== 'SCHEDULED' ||
      competition.tradingStartsAt > now
    ) {
      return false;
    }
    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'ACTIVE',
    );
    await transaction.competition.update({
      data: { status: 'ACTIVE' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        ...auditActor(actorUserId),
        after: { status: 'ACTIVE' },
        before: { status: competition.status },
        correlationId: `competition-activation:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:activated:v1`,
        reason: 'Configured UTC trading window started',
      },
    });
    return true;
  });
}

async function freezeCompetition(
  competitionId: string,
  now: Date,
  actorUserId?: string,
): Promise<CompetitionLifecycleResult> {
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, competitionId);
    const accountIds = await transaction.tradingAccount.findMany({
      orderBy: { id: 'asc' },
      select: { id: true },
      where: { competitionEntry: { competitionId } },
    });
    for (const account of accountIds) {
      await lockTradingAccount(transaction, account.id);
    }
    const competition = await transaction.competition.findUniqueOrThrow({
      include: {
        entries: {
          include: {
            tradingAccount: {
              include: {
                orders: {
                  orderBy: { id: 'asc' },
                  where: { status: { in: ['ACCEPTED', 'PARTIALLY_FILLED'] } },
                },
                ruleBreaches: { select: { id: true } },
              },
            },
            user: { select: { displayName: true, name: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
      where: { id: competitionId },
    });
    if (competition.status !== 'ACTIVE' || competition.tradingEndsAt > now) {
      return emptyResult();
    }
    const correlationId = `competition-cutoff:${competition.id}:${competition.tradingEndsAt.toISOString()}`;
    const snapshots = await cutoffSnapshots(
      transaction,
      competition.id,
      competition.tradingEndsAt,
    );
    let completedAccounts = 0;
    let completedEntries = 0;
    let expiredOrders = 0;
    let capturedScoreInputs = 0;

    for (const entry of competition.entries) {
      const account = entry.tradingAccount;
      if (account === null || entry.activatedAt === null) continue;
      for (const order of account.orders) {
        assertStateTransition(
          'Order',
          orderTransitions,
          order.status,
          'EXPIRED',
        );
        await transaction.order.update({
          data: {
            completedAt: competition.tradingEndsAt,
            status: 'EXPIRED',
            terminalReason: 'Competition trading window ended',
          },
          where: { id: order.id },
        });
        await transaction.auditEvent.create({
          data: {
            action: 'ORDER_EXPIRED_AT_COMPETITION_CUTOFF',
            ...auditActor(actorUserId),
            after: { status: 'EXPIRED' },
            before: { status: order.status },
            correlationId,
            entityId: order.id,
            entityType: 'Order',
            idempotencyKey: `audit:order:${order.id}:competition-cutoff:v1`,
            reason: 'Competition trading window ended',
          },
        });
        expiredOrders += 1;
      }

      const snapshot = snapshots.get(account.id) ?? {
        equityMinor: account.balanceMinor,
        finalScoreReachedAt: competition.tradingEndsAt,
        maxObservedDrawdownMinor: 0n,
        sourceSnapshotId: null,
        tradingAccountId: account.id,
      };
      const eligibility = eligibilityStatus({
        accountStatus: account.status,
        entryStatus: entry.status,
        hasRuleBreach: account.ruleBreaches.length > 0,
        isDisqualified:
          entry.disqualifiedAt !== null ||
          entry.status === 'DISQUALIFIED' ||
          account.status === 'DISQUALIFIED',
        sourceSnapshotId: snapshot.sourceSnapshotId,
      });
      await transaction.leaderboardScoreInput.create({
        data: {
          activatedAt: entry.activatedAt,
          capturedAt: now,
          competitionId: competition.id,
          cutoffAt: competition.tradingEndsAt,
          displayName: displayName(entry),
          eligibilityStatus: eligibility,
          entryId: entry.id,
          equityMinor: snapshot.equityMinor,
          finalScoreReachedAt: snapshot.finalScoreReachedAt,
          maxObservedDrawdownMinor: snapshot.maxObservedDrawdownMinor,
          netPerformanceMinor:
            snapshot.equityMinor - account.startingBalanceMinor,
          policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
          sourceSnapshotId: snapshot.sourceSnapshotId,
          startingBalanceMinor: account.startingBalanceMinor,
          tierId: entry.tierId,
          tradingAccountId: account.id,
        },
      });
      await transaction.auditEvent.create({
        data: {
          action: 'LEADERBOARD_SCORE_INPUT_CAPTURED',
          ...auditActor(actorUserId),
          after: {
            eligibilityStatus: eligibility,
            equityMinor: snapshot.equityMinor.toString(),
            policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
          },
          correlationId,
          entityId: entry.id,
          entityType: 'CompetitionEntry',
          idempotencyKey: `audit:entry:${entry.id}:leaderboard-input:v1`,
        },
      });
      capturedScoreInputs += 1;

      if (account.status === 'ACTIVE') {
        assertStateTransition(
          'TradingAccount',
          tradingAccountTransitions,
          account.status,
          'COMPLETED',
        );
        await transaction.tradingAccount.update({
          data: { status: 'COMPLETED' },
          where: { id: account.id },
        });
        await transaction.auditEvent.create({
          data: {
            action: 'STATE_TRANSITIONED',
            ...auditActor(actorUserId),
            after: { status: 'COMPLETED' },
            before: { status: account.status },
            correlationId,
            entityId: account.id,
            entityType: 'TradingAccount',
            idempotencyKey: `audit:account:${account.id}:competition-completed:v1`,
            reason: 'Competition trading window ended',
          },
        });
        completedAccounts += 1;
      }
      if (entry.status === 'ACTIVE') {
        assertStateTransition(
          'CompetitionEntry',
          competitionEntryTransitions,
          entry.status,
          'COMPLETED',
        );
        await transaction.competitionEntry.update({
          data: {
            completedAt: competition.tradingEndsAt,
            status: 'COMPLETED',
          },
          where: { id: entry.id },
        });
        await transaction.auditEvent.create({
          data: {
            action: 'STATE_TRANSITIONED',
            ...auditActor(actorUserId),
            after: { status: 'COMPLETED' },
            before: { status: entry.status },
            correlationId,
            entityId: entry.id,
            entityType: 'CompetitionEntry',
            idempotencyKey: `audit:entry:${entry.id}:competition-completed:v1`,
            reason: 'Competition trading window ended',
          },
        });
        completedEntries += 1;
      }
    }

    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'FROZEN',
    );
    await transaction.competition.update({
      data: { status: 'FROZEN' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        ...auditActor(actorUserId),
        after: { status: 'FROZEN' },
        before: { status: competition.status },
        correlationId,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:frozen:v1`,
        reason: 'Configured UTC trading window ended',
      },
    });
    return {
      activatedCompetitions: 0,
      capturedScoreInputs,
      completedAccounts,
      completedEntries,
      expiredOrders,
      frozenCompetitions: 1,
    };
  });
}

export async function processCompetitionLifecycle(
  now: Date = new Date(),
  context: CompetitionLifecycleContext = {},
): Promise<CompetitionLifecycleResult> {
  if (Number.isNaN(now.getTime())) {
    throw new Error('Competition lifecycle time must be valid');
  }
  const result = emptyResult();
  const scheduled = await database.competition.findMany({
    orderBy: { tradingStartsAt: 'asc' },
    select: { id: true },
    where: { status: 'SCHEDULED', tradingStartsAt: { lte: now } },
  });
  for (const competition of scheduled) {
    if (await activateCompetition(competition.id, now, context.actorUserId)) {
      result.activatedCompetitions += 1;
    }
  }
  const active = await database.competition.findMany({
    orderBy: { tradingEndsAt: 'asc' },
    select: { id: true },
    where: { status: 'ACTIVE', tradingEndsAt: { lte: now } },
  });
  for (const competition of active) {
    const frozen = await freezeCompetition(
      competition.id,
      now,
      context.actorUserId,
    );
    result.capturedScoreInputs += frozen.capturedScoreInputs;
    result.completedAccounts += frozen.completedAccounts;
    result.completedEntries += frozen.completedEntries;
    result.expiredOrders += frozen.expiredOrders;
    result.frozenCompetitions += frozen.frozenCompetitions;
  }
  return result;
}
