import { describe, expect, it } from 'vitest';

import { toPublicLeaderboardTiers } from './public-leaderboards';

describe('public leaderboard projection', () => {
  it('separates tiers, preserves ties, and exposes display-safe identity only', () => {
    const tiers = toPublicLeaderboardTiers(
      [
        { code: 'TRADER', id: 'tier-2', name: 'Trader' },
        { code: 'ROOKIE', id: 'tier-1', name: 'Rookie' },
      ],
      [
        {
          displayName: 'Safe Alias',
          displayOrder: 1,
          equityMinor: '1100000',
          isTied: true,
          maxObservedDrawdownMinor: '25000',
          netPerformanceMinor: '100000',
          rank: 1,
          tierId: 'tier-1',
        },
      ],
    );

    expect(tiers.map(({ code }) => code)).toEqual(['ROOKIE', 'TRADER']);
    expect(tiers[0]?.standings[0]).toEqual({
      displayName: 'Safe Alias',
      displayOrder: 1,
      equityMinor: 1_100_000n,
      isTied: true,
      maxObservedDrawdownMinor: 25_000n,
      netPerformanceMinor: 100_000n,
      rank: 1,
    });
    expect(tiers[0]?.standings[0]).not.toHaveProperty('entryId');
    expect(tiers[0]?.standings[0]).not.toHaveProperty('userId');
    expect(tiers[1]?.standings).toEqual([]);
  });
});
