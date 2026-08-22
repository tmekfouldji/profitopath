import { describe, expect, it } from 'vitest';

import {
  DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
  InvalidLeaderboardCandidateError,
  type LeaderboardCandidate,
  rankLeaderboard,
} from './leaderboard';

function candidate(
  entryId: string,
  overrides: Partial<LeaderboardCandidate> = {},
): LeaderboardCandidate {
  return {
    accountStatus: 'ACTIVE',
    activatedAt: new Date('2026-08-20T10:00:00.000Z'),
    displayName: `Trader ${entryId}`,
    disqualifiedAt: null,
    entryId,
    entryStatus: 'ACTIVE',
    equityMinor: 1_100_000n,
    finalScoreReachedAt: new Date('2026-08-28T20:00:00.000Z'),
    hasRuleBreach: false,
    maxObservedDrawdownMinor: 25_000n,
    startingBalanceMinor: 1_000_000n,
    tierId: 'rookie',
    userId: `user-${entryId}`,
    ...overrides,
  };
}

describe('development leaderboard policy', () => {
  it('ranks exact net performance within each tier only', () => {
    const standings = rankLeaderboard([
      candidate('rookie-low', { equityMinor: 1_050_000n }),
      candidate('trader', { equityMinor: 2_500_000n, tierId: 'trader' }),
      candidate('rookie-high', { equityMinor: 1_200_000n }),
    ]);

    expect(
      standings.map(({ entryId, netPerformanceMinor, rank, tierId }) => ({
        entryId,
        netPerformanceMinor,
        rank,
        tierId,
      })),
    ).toEqual([
      {
        entryId: 'rookie-high',
        netPerformanceMinor: 200_000n,
        rank: 1,
        tierId: 'rookie',
      },
      {
        entryId: 'rookie-low',
        netPerformanceMinor: 50_000n,
        rank: 2,
        tierId: 'rookie',
      },
      {
        entryId: 'trader',
        netPerformanceMinor: 1_500_000n,
        rank: 1,
        tierId: 'trader',
      },
    ]);
  });

  it('applies drawdown, score-time, and activation tie breaks in order', () => {
    const standings = rankLeaderboard([
      candidate('activation-late', {
        activatedAt: new Date('2026-08-20T11:00:00.000Z'),
      }),
      candidate('score-early', {
        finalScoreReachedAt: new Date('2026-08-28T19:00:00.000Z'),
      }),
      candidate('drawdown-low', { maxObservedDrawdownMinor: 20_000n }),
      candidate('activation-early', {
        activatedAt: new Date('2026-08-20T09:00:00.000Z'),
      }),
    ]);

    expect(standings.map((standing) => standing.entryId)).toEqual([
      'drawdown-low',
      'score-early',
      'activation-early',
      'activation-late',
    ]);
  });

  it('assigns true competition ranks after all tie criteria are exhausted', () => {
    const standings = rankLeaderboard([
      candidate('b'),
      candidate('a'),
      candidate('third', { equityMinor: 1_050_000n }),
    ]);

    expect(standings.map(({ entryId, rank }) => ({ entryId, rank }))).toEqual([
      { entryId: 'a', rank: 1 },
      { entryId: 'b', rank: 1 },
      { entryId: 'third', rank: 3 },
    ]);
    expect(standings[0]?.policyVersion).toBe(
      DEVELOPMENT_LEADERBOARD_POLICY_VERSION,
    );
  });

  it.each([
    { accountStatus: 'BREACHED' as const },
    { accountStatus: 'DISQUALIFIED' as const },
    { disqualifiedAt: new Date('2026-08-25T00:00:00.000Z') },
    { entryStatus: 'BREACHED' as const },
    { entryStatus: 'DISQUALIFIED' as const },
    { hasRuleBreach: true },
  ])('excludes ineligible account or entry state %#', (override) => {
    expect(rankLeaderboard([candidate('excluded', override)])).toEqual([]);
  });

  it('rejects malformed authoritative score inputs', () => {
    expect(() =>
      rankLeaderboard([
        candidate('invalid', { maxObservedDrawdownMinor: -1n }),
      ]),
    ).toThrow(InvalidLeaderboardCandidateError);
    expect(() =>
      rankLeaderboard([
        candidate('invalid', { activatedAt: new Date('invalid') }),
      ]),
    ).toThrow('timestamps must be valid');
  });
});
