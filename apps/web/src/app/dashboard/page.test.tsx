/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTraderDashboard: vi.fn(),
  getTraderLeaderboardSummaries: vi.fn(),
  getTraderPrizeOverview: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/server/queries', () => ({
  getTraderDashboard: mocks.getTraderDashboard,
  getTraderPrizeOverview: mocks.getTraderPrizeOverview,
}));
vi.mock('@/server/trader-leaderboards', () => ({
  getTraderLeaderboardSummaries: mocks.getTraderLeaderboardSummaries,
}));

import DashboardPage from './page';

afterEach(cleanup);

describe('trader prize browser view', () => {
  it('shows only the trader-safe manual review and credit state', async () => {
    mocks.requireUser.mockResolvedValue({ id: 'trader-1' });
    mocks.getTraderDashboard.mockResolvedValue([]);
    mocks.getTraderLeaderboardSummaries.mockResolvedValue(new Map());
    mocks.getTraderPrizeOverview.mockResolvedValue([
      {
        amountMinor: 500,
        competition: {
          code: 'DEV-WEEK-20260330',
          name: 'Prize Operations Week',
        },
        currency: 'USD',
        freeEntryCredits: 2,
        id: 'prize-1',
        issuedFreeEntryCredits: [
          {
            createdAt: new Date('2026-04-05T15:00:00.000Z'),
            id: 'credit-1',
            ordinal: 1,
            status: 'AVAILABLE',
          },
          {
            createdAt: new Date('2026-04-05T15:00:00.000Z'),
            id: 'credit-2',
            ordinal: 2,
            status: 'AVAILABLE',
          },
        ],
        kycStatus: 'APPROVED',
        payout: {
          paidAt: new Date('2026-04-05T14:00:00.000Z'),
          reconciledAt: new Date('2026-04-05T15:00:00.000Z'),
          status: 'PAID',
        },
        rank: 5,
        status: 'PAID',
        tier: { code: 'ROOKIE', name: 'Rookie' },
        winnerReviewStatus: 'CONFIRMED',
      },
    ]);

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('Prize review ledger')).toBeTruthy();
    expect(screen.getByText('2 available')).toBeTruthy();
    expect(screen.getByText(/no customer trading deposit/i)).toBeTruthy();
    expect(screen.queryByText(/transaction reference/i)).toBeNull();
  });
});
