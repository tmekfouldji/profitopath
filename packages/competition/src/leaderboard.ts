import type {
  CompetitionEntryState,
  TradingAccountState,
} from './state-machine';

export const DEVELOPMENT_LEADERBOARD_POLICY_VERSION = 1;

export interface LeaderboardCandidate {
  accountStatus: TradingAccountState;
  activatedAt: Date;
  displayName: string;
  disqualifiedAt: Date | null;
  entryId: string;
  entryStatus: CompetitionEntryState;
  equityMinor: bigint;
  finalScoreReachedAt: Date;
  hasRuleBreach: boolean;
  maxObservedDrawdownMinor: bigint;
  startingBalanceMinor: bigint;
  tierId: string;
  userId: string;
}

export interface LeaderboardStanding {
  activatedAt: Date;
  displayName: string;
  entryId: string;
  equityMinor: bigint;
  finalScoreReachedAt: Date;
  maxObservedDrawdownMinor: bigint;
  netPerformanceMinor: bigint;
  policyVersion: number;
  rank: number;
  startingBalanceMinor: bigint;
  tierId: string;
  userId: string;
}

export class InvalidLeaderboardCandidateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeaderboardCandidateError';
  }
}

function assertCandidate(candidate: LeaderboardCandidate): void {
  if (
    candidate.entryId.trim() === '' ||
    candidate.tierId.trim() === '' ||
    candidate.userId.trim() === '' ||
    candidate.displayName.trim() === ''
  ) {
    throw new InvalidLeaderboardCandidateError(
      'Leaderboard candidate identifiers and display name are required',
    );
  }
  if (
    Number.isNaN(candidate.activatedAt.getTime()) ||
    Number.isNaN(candidate.finalScoreReachedAt.getTime())
  ) {
    throw new InvalidLeaderboardCandidateError(
      'Leaderboard candidate timestamps must be valid',
    );
  }
  if (candidate.startingBalanceMinor <= 0n) {
    throw new InvalidLeaderboardCandidateError(
      'Leaderboard starting balance must be positive',
    );
  }
  if (candidate.maxObservedDrawdownMinor < 0n) {
    throw new InvalidLeaderboardCandidateError(
      'Leaderboard maximum drawdown cannot be negative',
    );
  }
}

export function isLeaderboardEligible(
  candidate: LeaderboardCandidate,
): boolean {
  assertCandidate(candidate);
  return (
    (candidate.entryStatus === 'ACTIVE' ||
      candidate.entryStatus === 'COMPLETED') &&
    (candidate.accountStatus === 'ACTIVE' ||
      candidate.accountStatus === 'COMPLETED') &&
    !candidate.hasRuleBreach &&
    candidate.disqualifiedAt === null
  );
}

function compareBigIntAscending(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareBigIntDescending(left: bigint, right: bigint): number {
  return compareBigIntAscending(right, left);
}

function compareRankCriteria(
  left: Omit<LeaderboardStanding, 'rank'>,
  right: Omit<LeaderboardStanding, 'rank'>,
): number {
  return (
    compareBigIntDescending(
      left.netPerformanceMinor,
      right.netPerformanceMinor,
    ) ||
    compareBigIntAscending(
      left.maxObservedDrawdownMinor,
      right.maxObservedDrawdownMinor,
    ) ||
    left.finalScoreReachedAt.getTime() - right.finalScoreReachedAt.getTime() ||
    left.activatedAt.getTime() - right.activatedAt.getTime()
  );
}

export function rankLeaderboard(
  candidates: readonly LeaderboardCandidate[],
): LeaderboardStanding[] {
  const eligible = candidates
    .filter(isLeaderboardEligible)
    .map((candidate) => ({
      activatedAt: new Date(candidate.activatedAt),
      displayName: candidate.displayName.trim(),
      entryId: candidate.entryId,
      equityMinor: candidate.equityMinor,
      finalScoreReachedAt: new Date(candidate.finalScoreReachedAt),
      maxObservedDrawdownMinor: candidate.maxObservedDrawdownMinor,
      netPerformanceMinor:
        candidate.equityMinor - candidate.startingBalanceMinor,
      policyVersion: DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
      startingBalanceMinor: candidate.startingBalanceMinor,
      tierId: candidate.tierId,
      userId: candidate.userId,
    }));
  const tierIds = [
    ...new Set(eligible.map((candidate) => candidate.tierId)),
  ].sort();
  return tierIds.flatMap((tierId) => {
    const ordered = eligible
      .filter((candidate) => candidate.tierId === tierId)
      .sort(
        (left, right) =>
          compareRankCriteria(left, right) ||
          left.entryId.localeCompare(right.entryId),
      );
    let previous: Omit<LeaderboardStanding, 'rank'> | undefined;
    let rank = 0;
    return ordered.map((standing, index) => {
      if (
        previous === undefined ||
        compareRankCriteria(previous, standing) !== 0
      ) {
        rank = index + 1;
      }
      previous = standing;
      return { ...standing, rank };
    });
  });
}
