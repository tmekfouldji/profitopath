import 'server-only';

import {
  DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
  recomputeFrozenLeaderboard,
  recomputeLiveLeaderboard,
  type SerializedLeaderboardStanding,
} from '@profitopath/competition';
import { database } from '@profitopath/database';

export interface PublicLeaderboardStanding {
  displayName: string;
  displayOrder: number;
  equityMinor: bigint;
  isTied: boolean;
  maxObservedDrawdownMinor: bigint;
  netPerformanceMinor: bigint;
  rank: number;
}

export interface PublicLeaderboardTier {
  code: string;
  id: string;
  name: string;
  standings: PublicLeaderboardStanding[];
}

export interface PublicLeaderboardView {
  asOf: Date;
  competition: {
    code: string;
    id: string;
    name: string;
    status: 'ACTIVE' | 'FROZEN' | 'FINALIZED' | 'ARCHIVED';
    tradingEndsAt: Date;
    tradingStartsAt: Date;
  };
  mode: 'LIVE' | 'CUTOFF_REVIEW' | 'FINAL';
  policyVersion: number;
  resultHash: string | null;
  rulesVersion: number;
  tiers: PublicLeaderboardTier[];
}

interface TierIdentity {
  code: string;
  id: string;
  name: string;
}

type PublicSourceStanding = Pick<
  SerializedLeaderboardStanding,
  | 'displayName'
  | 'displayOrder'
  | 'equityMinor'
  | 'isTied'
  | 'maxObservedDrawdownMinor'
  | 'netPerformanceMinor'
  | 'rank'
  | 'tierId'
>;

export function toPublicLeaderboardTiers(
  tiers: readonly TierIdentity[],
  standings: readonly PublicSourceStanding[],
): PublicLeaderboardTier[] {
  return [...tiers]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((tier) => ({
      ...tier,
      standings: standings
        .filter((standing) => standing.tierId === tier.id)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((standing) => ({
          displayName: standing.displayName,
          displayOrder: standing.displayOrder,
          equityMinor: BigInt(standing.equityMinor),
          isTied: standing.isTied,
          maxObservedDrawdownMinor: BigInt(standing.maxObservedDrawdownMinor),
          netPerformanceMinor: BigInt(standing.netPerformanceMinor),
          rank: standing.rank,
        })),
    }));
}

export function listPublicLeaderboardCompetitions() {
  return database.competition.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { tradingEndsAt: 'desc' },
    take: 40,
    where: { status: { in: ['ACTIVE', 'FROZEN', 'FINALIZED', 'ARCHIVED'] } },
  });
}

export async function getPublicLeaderboard(
  competitionId: string,
): Promise<PublicLeaderboardView | null> {
  const competition = await database.competition.findUnique({
    include: {
      entries: {
        select: { tier: { select: { code: true, id: true, name: true } } },
      },
      finalization: {
        include: {
          standings: {
            include: { tier: { select: { code: true, id: true, name: true } } },
            orderBy: [{ tierId: 'asc' }, { displayOrder: 'asc' }],
          },
        },
      },
    },
    where: { id: competitionId },
  });
  if (
    competition === null ||
    !['ACTIVE', 'FROZEN', 'FINALIZED', 'ARCHIVED'].includes(competition.status)
  ) {
    return null;
  }
  const tierMap = new Map<string, TierIdentity>();
  for (const entry of competition.entries) {
    tierMap.set(entry.tier.id, entry.tier);
  }
  const identity = {
    code: competition.code,
    id: competition.id,
    name: competition.name,
    status: competition.status,
    tradingEndsAt: competition.tradingEndsAt,
    tradingStartsAt: competition.tradingStartsAt,
  } as PublicLeaderboardView['competition'];

  if (competition.status === 'ACTIVE' || competition.status === 'FROZEN') {
    const result =
      competition.status === 'ACTIVE'
        ? await recomputeLiveLeaderboard({ competitionId })
        : await recomputeFrozenLeaderboard(competitionId);
    return {
      asOf: new Date(result.asOf),
      competition: identity,
      mode: competition.status === 'ACTIVE' ? 'LIVE' : 'CUTOFF_REVIEW',
      policyVersion: result.policyVersion,
      resultHash: null,
      rulesVersion: result.rulesVersion,
      tiers: toPublicLeaderboardTiers([...tierMap.values()], result.standings),
    };
  }

  if (competition.finalization === null) {
    throw new Error('Finalized competition is missing its immutable result');
  }
  const serialized: PublicSourceStanding[] =
    competition.finalization.standings.map((standing) => {
      tierMap.set(standing.tier.id, standing.tier);
      return {
        displayName: standing.displayName,
        displayOrder: standing.displayOrder,
        equityMinor: standing.equityMinor.toString(),
        isTied: standing.isTied,
        maxObservedDrawdownMinor: standing.maxObservedDrawdownMinor.toString(),
        netPerformanceMinor: standing.netPerformanceMinor.toString(),
        rank: standing.rank,
        tierId: standing.tierId,
      };
    });
  return {
    asOf: competition.tradingEndsAt,
    competition: identity,
    mode: 'FINAL',
    policyVersion:
      competition.finalization.standings[0]?.policyVersion ??
      DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
    resultHash: competition.finalization.resultHash,
    rulesVersion: competition.finalization.rulesVersion,
    tiers: toPublicLeaderboardTiers([...tierMap.values()], serialized),
  };
}
