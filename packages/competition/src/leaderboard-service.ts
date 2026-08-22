import { createHash } from 'node:crypto';

import { database, type Prisma } from '@profitopath/database';

import {
  DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
  type LeaderboardCandidate,
  type LeaderboardStanding,
  rankLeaderboard,
} from './leaderboard';
import { assertStateTransition, competitionTransitions } from './state-machine';

export interface SerializedLeaderboardStanding {
  activatedAt: string;
  displayName: string;
  displayOrder: number;
  entryId: string;
  equityMinor: string;
  finalScoreReachedAt: string;
  isTied: boolean;
  maxObservedDrawdownMinor: string;
  netPerformanceMinor: string;
  rank: number;
  startingBalanceMinor: string;
  tierId: string;
  userId: string;
}

export interface CanonicalLeaderboardResult {
  asOf: string;
  competitionId: string;
  policyVersion: number;
  rulesVersion: number;
  standings: SerializedLeaderboardStanding[];
}

export interface FinalizeLeaderboardResult {
  alreadyFinalized: boolean;
  finalizationId: string;
  result: CanonicalLeaderboardResult;
  resultHash: string;
}

interface LiveLeaderboardRow {
  accountStatus: LeaderboardCandidate['accountStatus'];
  activatedAt: Date;
  displayName: string;
  disqualifiedAt: Date | null;
  entryId: string;
  entryStatus: LeaderboardCandidate['entryStatus'];
  equityMinor: bigint;
  finalScoreReachedAt: Date;
  hasRuleBreach: boolean;
  maxObservedDrawdownMinor: bigint;
  startingBalanceMinor: bigint;
  tierId: string;
  userId: string;
}

export class LeaderboardFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaderboardFinalizationError';
  }
}

function serializeStandings(
  standings: readonly LeaderboardStanding[],
): SerializedLeaderboardStanding[] {
  const rankCounts = new Map<string, number>();
  for (const standing of standings) {
    const key = `${standing.tierId}:${standing.rank}`;
    rankCounts.set(key, (rankCounts.get(key) ?? 0) + 1);
  }
  const tierOrder = new Map<string, number>();
  return standings.map((standing) => {
    const displayOrder = (tierOrder.get(standing.tierId) ?? 0) + 1;
    tierOrder.set(standing.tierId, displayOrder);
    return {
      activatedAt: standing.activatedAt.toISOString(),
      displayName: standing.displayName,
      displayOrder,
      entryId: standing.entryId,
      equityMinor: standing.equityMinor.toString(),
      finalScoreReachedAt: standing.finalScoreReachedAt.toISOString(),
      isTied: (rankCounts.get(`${standing.tierId}:${standing.rank}`) ?? 0) > 1,
      maxObservedDrawdownMinor: standing.maxObservedDrawdownMinor.toString(),
      netPerformanceMinor: standing.netPerformanceMinor.toString(),
      rank: standing.rank,
      startingBalanceMinor: standing.startingBalanceMinor.toString(),
      tierId: standing.tierId,
      userId: standing.userId,
    };
  });
}

export function buildCanonicalLeaderboardResult(input: {
  asOf: Date;
  competitionId: string;
  rulesVersion: number;
  standings: readonly LeaderboardStanding[];
}): CanonicalLeaderboardResult {
  if (Number.isNaN(input.asOf.getTime())) {
    throw new LeaderboardFinalizationError('Leaderboard as-of time is invalid');
  }
  return {
    asOf: input.asOf.toISOString(),
    competitionId: input.competitionId,
    policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
    rulesVersion: input.rulesVersion,
    standings: serializeStandings(input.standings),
  };
}

export function hashLeaderboardResult(
  result: CanonicalLeaderboardResult,
): string {
  return createHash('sha256').update(JSON.stringify(result)).digest('hex');
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

async function rankCutoffInputs(
  transaction: Prisma.TransactionClient,
  competitionId: string,
): Promise<LeaderboardStanding[]> {
  const inputs = await transaction.leaderboardScoreInput.findMany({
    include: { entry: { select: { userId: true } } },
    orderBy: [{ tierId: 'asc' }, { entryId: 'asc' }],
    where: {
      competitionId,
      eligibilityStatus: 'ELIGIBLE',
      policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
    },
  });
  const candidates: LeaderboardCandidate[] = inputs.map((input) => ({
    accountStatus: 'COMPLETED',
    activatedAt: input.activatedAt,
    displayName: input.displayName,
    disqualifiedAt: null,
    entryId: input.entryId,
    entryStatus: 'COMPLETED',
    equityMinor: input.equityMinor,
    finalScoreReachedAt: input.finalScoreReachedAt,
    hasRuleBreach: false,
    maxObservedDrawdownMinor: input.maxObservedDrawdownMinor,
    startingBalanceMinor: input.startingBalanceMinor,
    tierId: input.tierId,
    userId: input.entry.userId,
  }));
  return rankLeaderboard(candidates);
}

async function rankLiveState(
  transaction: Prisma.TransactionClient,
  competitionId: string,
  asOf: Date,
): Promise<LeaderboardStanding[]> {
  const rows = await transaction.$queryRaw<LiveLeaderboardRow[]>`
    SELECT
      account.status AS "accountStatus",
      entry."activatedAt" AS "activatedAt",
      COALESCE(
        NULLIF(BTRIM(trader."displayName"), ''),
        NULLIF(BTRIM(trader.name), ''),
        'Trader-' || LEFT(entry.id::text, 8)
      ) AS "displayName",
      entry."disqualifiedAt" AS "disqualifiedAt",
      entry.id AS "entryId",
      entry.status AS "entryStatus",
      latest."equityMinor" AS "equityMinor",
      COALESCE((
        SELECT MIN(score."asOf")
        FROM "AccountSnapshot" score
        WHERE score."tradingAccountId" = account.id
          AND score."asOf" <= ${asOf}
          AND score."equityMinor" = latest."equityMinor"
      ), ${asOf}) AS "finalScoreReachedAt",
      EXISTS(
        SELECT 1
        FROM "RuleBreach" breach
        WHERE breach."tradingAccountId" = account.id
      ) AS "hasRuleBreach",
      COALESCE((
        SELECT MAX(history."maxDrawdownMinor")
        FROM "AccountSnapshot" history
        WHERE history."tradingAccountId" = account.id
          AND history."asOf" <= ${asOf}
      ), 0) AS "maxObservedDrawdownMinor",
      account."startingBalanceMinor" AS "startingBalanceMinor",
      entry."tierId" AS "tierId",
      entry."userId" AS "userId"
    FROM "CompetitionEntry" entry
    INNER JOIN "TradingAccount" account
      ON account."competitionEntryId" = entry.id
    INNER JOIN "User" trader
      ON trader.id = entry."userId"
    INNER JOIN LATERAL (
      SELECT snapshot."equityMinor"
      FROM "AccountSnapshot" snapshot
      WHERE snapshot."tradingAccountId" = account.id
        AND snapshot."asOf" <= ${asOf}
      ORDER BY snapshot."asOf" DESC, snapshot.sequence DESC
      LIMIT 1
    ) latest ON true
    WHERE entry."competitionId" = ${competitionId}::uuid
      AND entry."activatedAt" IS NOT NULL
  `;
  return rankLeaderboard(rows);
}

export async function recomputeLiveLeaderboard(input: {
  asOf?: Date;
  competitionId: string;
}): Promise<CanonicalLeaderboardResult> {
  const requestedAsOf = input.asOf ?? new Date();
  if (Number.isNaN(requestedAsOf.getTime())) {
    throw new LeaderboardFinalizationError('Leaderboard as-of time is invalid');
  }
  return database.$transaction(
    async (transaction) => {
      const competition = await transaction.competition.findUniqueOrThrow({
        where: { id: input.competitionId },
      });
      if (competition.status !== 'ACTIVE') {
        throw new LeaderboardFinalizationError(
          'Live leaderboard requires an active competition',
        );
      }
      const asOf =
        requestedAsOf < competition.tradingEndsAt
          ? requestedAsOf
          : competition.tradingEndsAt;
      return buildCanonicalLeaderboardResult({
        asOf,
        competitionId: competition.id,
        rulesVersion: competition.rulesVersion,
        standings: await rankLiveState(transaction, competition.id, asOf),
      });
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

export async function recomputeFrozenLeaderboard(
  competitionId: string,
): Promise<CanonicalLeaderboardResult> {
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      where: { id: competitionId },
    });
    if (competition.status !== 'FROZEN' && competition.status !== 'FINALIZED') {
      throw new LeaderboardFinalizationError(
        'Competition must be frozen before cutoff leaderboard recompute',
      );
    }
    const accountCount = await transaction.tradingAccount.count({
      where: { competitionEntry: { competitionId } },
    });
    const inputCount = await transaction.leaderboardScoreInput.count({
      where: {
        competitionId,
        policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
      },
    });
    if (inputCount !== accountCount) {
      throw new LeaderboardFinalizationError(
        'Competition cutoff inputs are incomplete',
      );
    }
    return buildCanonicalLeaderboardResult({
      asOf: competition.tradingEndsAt,
      competitionId: competition.id,
      rulesVersion: competition.rulesVersion,
      standings: await rankCutoffInputs(transaction, competition.id),
    });
  });
}

export async function finalizeLeaderboard(input: {
  actorUserId?: string;
  competitionId: string;
  finalizedAt?: Date;
}): Promise<FinalizeLeaderboardResult> {
  const finalizedAt = input.finalizedAt ?? new Date();
  if (Number.isNaN(finalizedAt.getTime())) {
    throw new LeaderboardFinalizationError('Finalization time is invalid');
  }
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      include: { finalization: true },
      where: { id: input.competitionId },
    });
    if (competition.status !== 'FROZEN' && competition.status !== 'FINALIZED') {
      throw new LeaderboardFinalizationError(
        'Only a frozen competition can be finalized',
      );
    }
    const accountCount = await transaction.tradingAccount.count({
      where: { competitionEntry: { competitionId: competition.id } },
    });
    const inputCount = await transaction.leaderboardScoreInput.count({
      where: {
        competitionId: competition.id,
        policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
      },
    });
    if (inputCount !== accountCount) {
      throw new LeaderboardFinalizationError(
        'Competition cutoff inputs are incomplete',
      );
    }
    const standings = await rankCutoffInputs(transaction, competition.id);
    const result = buildCanonicalLeaderboardResult({
      asOf: competition.tradingEndsAt,
      competitionId: competition.id,
      rulesVersion: competition.rulesVersion,
      standings,
    });
    const resultHash = hashLeaderboardResult(result);
    if (competition.finalization !== null) {
      if (competition.finalization.resultHash !== resultHash) {
        throw new LeaderboardFinalizationError(
          'Existing finalization does not match authoritative recompute',
        );
      }
      return {
        alreadyFinalized: true,
        finalizationId: competition.finalization.id,
        result,
        resultHash,
      };
    }
    if (competition.status !== 'FROZEN') {
      throw new LeaderboardFinalizationError(
        'Finalized competition is missing its immutable result',
      );
    }
    const finalization = await transaction.leaderboardFinalization.create({
      data: {
        competitionId: competition.id,
        finalizedAt,
        result: result as unknown as Prisma.InputJsonValue,
        resultHash,
        rulesVersion: competition.rulesVersion,
      },
    });
    if (result.standings.length > 0) {
      await transaction.leaderboardStanding.createMany({
        data: result.standings.map((standing) => ({
          activatedAt: new Date(standing.activatedAt),
          competitionId: competition.id,
          displayName: standing.displayName,
          displayOrder: standing.displayOrder,
          entryId: standing.entryId,
          equityMinor: BigInt(standing.equityMinor),
          finalScoreReachedAt: new Date(standing.finalScoreReachedAt),
          finalizationId: finalization.id,
          isTied: standing.isTied,
          maxObservedDrawdownMinor: BigInt(standing.maxObservedDrawdownMinor),
          netPerformanceMinor: BigInt(standing.netPerformanceMinor),
          policyVersion: result.policyVersion,
          rank: standing.rank,
          startingBalanceMinor: BigInt(standing.startingBalanceMinor),
          tierId: standing.tierId,
        })),
      });
    }
    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'FINALIZED',
    );
    await transaction.competition.update({
      data: { finalizedAt, status: 'FINALIZED' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'LEADERBOARD_FINALIZED',
        ...(input.actorUserId === undefined
          ? {}
          : { actorUserId: input.actorUserId }),
        after: {
          policyVersion: result.policyVersion,
          resultHash,
          standings: result.standings.length,
          status: 'FINALIZED',
        },
        before: { status: competition.status },
        correlationId: `leaderboard-finalization:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:leaderboard-finalized:v1`,
        reason: 'Authoritative cutoff leaderboard finalized',
      },
    });
    return {
      alreadyFinalized: false,
      finalizationId: finalization.id,
      result,
      resultHash,
    };
  });
}
