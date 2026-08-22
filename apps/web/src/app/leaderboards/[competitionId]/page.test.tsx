/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), notFound: vi.fn() }));
vi.mock('@/server/public-leaderboards', () => ({
  getPublicLeaderboard: mocks.get,
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

import LeaderboardPage from './page';

afterEach(cleanup);

describe('leaderboard detail browser view', () => {
  it('renders true ties, provenance, and the immutable hash', async () => {
    mocks.get.mockResolvedValue({
      asOf: new Date('2026-08-28T21:00:00.000Z'),
      competition: {
        code: 'WEEK-34',
        id: 'competition-1',
        name: 'Sealed Week',
        status: 'FINALIZED',
        tradingEndsAt: new Date('2026-08-28T21:00:00.000Z'),
        tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
      },
      mode: 'FINAL',
      policyVersion: 1,
      resultHash: 'a'.repeat(64),
      rulesVersion: 1,
      tiers: [
        {
          code: 'ROOKIE',
          id: 'tier-1',
          name: 'Rookie',
          standings: [
            {
              displayName: 'Safe Alias',
              displayOrder: 1,
              equityMinor: 1_100_000n,
              isTied: true,
              maxObservedDrawdownMinor: 25_000n,
              netPerformanceMinor: 100_000n,
              rank: 1,
            },
          ],
        },
      ],
    });

    render(
      await LeaderboardPage({
        params: Promise.resolve({ competitionId: 'competition-1' }),
      }),
    );

    expect(screen.getByText('T1')).toBeTruthy();
    expect(screen.getByText('Safe Alias')).toBeTruthy();
    expect(screen.getByText('Development v1')).toBeTruthy();
    expect(screen.getByText('a'.repeat(20))).toBeTruthy();
    expect(screen.getByText('+$1,000.00')).toBeTruthy();
    expect(screen.getByText(/immutable final standing rows/i)).toBeTruthy();
  });
});
