import 'server-only';

import {
  recomputeFrozenLeaderboard,
  recomputeLiveLeaderboard,
  type CanonicalLeaderboardResult,
} from '@profitopath/competition';
import {
  database,
  type CompetitionEntryStatus,
  type CompetitionStatus,
  type LeaderboardEligibilityStatus,
  type TradingAccountStatus,
} from '@profitopath/database';

export type TraderLeaderboardEligibility =
  LeaderboardEligibilityStatus | 'NOT_STARTED' | 'NO_ACCOUNT' | 'RECONCILING';

export interface TraderLeaderboardSummary {
  asOf: Date | null;
  competitionId: string;
  competitionStatus: CompetitionStatus;
  eligible: boolean;
  eligibility: TraderLeaderboardEligibility;
  entryId: string;
  equityMinor: bigint | null;
  isTied: boolean;
  maxObservedDrawdownMinor: bigint | null;
  netPerformanceMinor: bigint | null;
  rank: number | null;
}

export function deriveLiveTraderEligibility(input: {
  accountStatus: TradingAccountStatus | null;
  competitionStatus: CompetitionStatus;
  disqualifiedAt: Date | null;
  entryStatus: CompetitionEntryStatus;
  hasRuleBreach: boolean;
  hasSnapshot: boolean;
}): TraderLeaderboardEligibility {
  if (input.competitionStatus === 'SCHEDULED') return 'NOT_STARTED';
  if (
    input.disqualifiedAt !== null ||
    input.entryStatus === 'DISQUALIFIED' ||
    input.accountStatus === 'DISQUALIFIED'
  ) {
    return 'DISQUALIFIED';
  }
  if (
    input.hasRuleBreach ||
    input.entryStatus === 'BREACHED' ||
    input.accountStatus === 'BREACHED'
  ) {
    return 'RULE_BREACH';
  }
  if (!['ACTIVE', 'COMPLETED'].includes(input.entryStatus)) {
    return 'ENTRY_STATUS';
  }
  if (input.accountStatus === null) return 'NO_ACCOUNT';
  if (!['ACTIVE', 'COMPLETED'].includes(input.accountStatus)) {
    return 'ACCOUNT_STATUS';
  }
  return input.hasSnapshot ? 'ELIGIBLE' : 'MISSING_SNAPSHOT';
}

export async function getTraderLeaderboardSummaries(
  userId: string,
): Promise<Map<string, TraderLeaderboardSummary>> {
  const entries = await database.competitionEntry.findMany({
    include: {
      competition: true,
      leaderboardScoreInputs: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
      leaderboardStandings: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      tradingAccount: {
        include: {
          ruleBreaches: { select: { id: true } },
          snapshots: {
            orderBy: [{ asOf: 'desc' }, { sequence: 'desc' }],
            take: 1,
          },
        },
      },
    },
    where: { userId },
  });
  const recomputes = new Map<
    string,
    Promise<CanonicalLeaderboardResult | null>
  >();
  for (const entry of entries) {
    if (entry.competition.status === 'ACTIVE') {
      recomputes.set(
        entry.competitionId,
        recomputeLiveLeaderboard({ competitionId: entry.competitionId }).catch(
          () => null,
        ),
      );
    } else if (entry.competition.status === 'FROZEN') {
      recomputes.set(
        entry.competitionId,
        recomputeFrozenLeaderboard(entry.competitionId).catch(() => null),
      );
    }
  }

  const summaries = new Map<string, TraderLeaderboardSummary>();
  await Promise.all(
    entries.map(async (entry) => {
      const account = entry.tradingAccount;
      const score = entry.leaderboardScoreInputs[0];
      const finalStanding = entry.leaderboardStandings[0];
      const recompute = await recomputes.get(entry.competitionId);
      const liveStanding = recompute?.standings.find(
        (standing) => standing.entryId === entry.id,
      );
      let eligibility: TraderLeaderboardEligibility;
      if (
        ['FINALIZED', 'ARCHIVED', 'FROZEN'].includes(entry.competition.status)
      ) {
        eligibility = score?.eligibilityStatus ?? 'RECONCILING';
      } else {
        eligibility = deriveLiveTraderEligibility({
          accountStatus: account?.status ?? null,
          competitionStatus: entry.competition.status,
          disqualifiedAt: entry.disqualifiedAt,
          entryStatus: entry.status,
          hasRuleBreach: (account?.ruleBreaches.length ?? 0) > 0,
          hasSnapshot: (account?.snapshots.length ?? 0) > 0,
        });
      }
      const latestSnapshot = account?.snapshots[0];
      let maxDrawdown = latestSnapshot?.maxDrawdownMinor ?? null;
      if (
        entry.competition.status === 'ACTIVE' &&
        account !== null &&
        account !== undefined &&
        liveStanding === undefined
      ) {
        const aggregate = await database.accountSnapshot.aggregate({
          _max: { maxDrawdownMinor: true },
          where: {
            asOf: { lte: entry.competition.tradingEndsAt },
            tradingAccountId: account.id,
          },
        });
        maxDrawdown = aggregate._max.maxDrawdownMinor;
      }
      const persistedStanding =
        ['FINALIZED', 'ARCHIVED'].includes(entry.competition.status) &&
        finalStanding !== undefined
          ? finalStanding
          : undefined;
      const equityMinor =
        persistedStanding?.equityMinor ??
        (liveStanding === undefined
          ? undefined
          : BigInt(liveStanding.equityMinor)) ??
        score?.equityMinor ??
        latestSnapshot?.equityMinor ??
        null;
      summaries.set(entry.id, {
        asOf:
          persistedStanding === undefined && score === undefined
            ? recompute === null || recompute === undefined
              ? (latestSnapshot?.asOf ?? null)
              : new Date(recompute.asOf)
            : entry.competition.tradingEndsAt,
        competitionId: entry.competitionId,
        competitionStatus: entry.competition.status,
        eligible: eligibility === 'ELIGIBLE',
        eligibility,
        entryId: entry.id,
        equityMinor,
        isTied: persistedStanding?.isTied ?? liveStanding?.isTied ?? false,
        maxObservedDrawdownMinor:
          persistedStanding?.maxObservedDrawdownMinor ??
          (liveStanding === undefined
            ? undefined
            : BigInt(liveStanding.maxObservedDrawdownMinor)) ??
          score?.maxObservedDrawdownMinor ??
          maxDrawdown,
        netPerformanceMinor:
          persistedStanding?.netPerformanceMinor ??
          (liveStanding === undefined
            ? undefined
            : BigInt(liveStanding.netPerformanceMinor)) ??
          score?.netPerformanceMinor ??
          (equityMinor === null || account === null || account === undefined
            ? null
            : equityMinor - account.startingBalanceMinor),
        rank: persistedStanding?.rank ?? liveStanding?.rank ?? null,
      });
    }),
  );
  return summaries;
}
