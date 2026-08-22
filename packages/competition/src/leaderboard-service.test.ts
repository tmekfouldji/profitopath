import { describe, expect, it } from 'vitest';

import type { LeaderboardStanding } from './leaderboard';
import {
  buildCanonicalLeaderboardResult,
  hashLeaderboardResult,
} from './leaderboard-service';

function standing(entryId: string, rank: number): LeaderboardStanding {
  return {
    activatedAt: new Date('2026-08-20T10:00:00.000Z'),
    displayName: `Trader ${entryId}`,
    entryId,
    equityMinor: 1_100_000n,
    finalScoreReachedAt: new Date('2026-08-28T20:00:00.000Z'),
    maxObservedDrawdownMinor: 25_000n,
    netPerformanceMinor: 100_000n,
    policyVersion: 1,
    rank,
    startingBalanceMinor: 1_000_000n,
    tierId: 'rookie',
    userId: `user-${entryId}`,
  };
}

describe('canonical leaderboard finalization', () => {
  it('serializes exact values, per-tier display order, and true tie flags', () => {
    const result = buildCanonicalLeaderboardResult({
      asOf: new Date('2026-08-28T21:00:00.000Z'),
      competitionId: 'competition-1',
      rulesVersion: 1,
      standings: [standing('a', 1), standing('b', 1), standing('c', 3)],
    });

    expect(result.standings).toMatchObject([
      { displayOrder: 1, equityMinor: '1100000', isTied: true, rank: 1 },
      { displayOrder: 2, isTied: true, rank: 1 },
      { displayOrder: 3, isTied: false, rank: 3 },
    ]);
  });

  it('produces the same hash without wall-clock finalization input', () => {
    const input = {
      asOf: new Date('2026-08-28T21:00:00.000Z'),
      competitionId: 'competition-1',
      rulesVersion: 1,
      standings: [standing('a', 1)],
    };

    expect(hashLeaderboardResult(buildCanonicalLeaderboardResult(input))).toBe(
      hashLeaderboardResult(buildCanonicalLeaderboardResult(input)),
    );
    expect(
      hashLeaderboardResult(buildCanonicalLeaderboardResult(input)),
    ).toMatch(/^[a-f0-9]{64}$/);
  });
});
