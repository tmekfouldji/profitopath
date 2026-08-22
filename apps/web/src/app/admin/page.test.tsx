/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminOverview: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock('@/server/auth/session', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/server/queries', () => ({
  getAdminOverview: mocks.getAdminOverview,
}));
vi.mock('./actions', () => ({
  approvePayoutAction: vi.fn(),
  approvePrizeAction: vi.fn(),
  archiveCompetitionAction: vi.fn(),
  cancelManualPayoutAction: vi.fn(),
  derivePrizeLedgerAction: vi.fn(),
  disqualifyEntryAction: vi.fn(),
  finalizeLeaderboardAction: vi.fn(),
  markManualPayoutPaidAction: vi.fn(),
  reconcileManualPayoutAction: vi.fn(),
  recordManualPayoutFailureAction: vi.fn(),
  recomputeLeaderboardAction: vi.fn(),
  reviewPrizeWinnerAction: vi.fn(),
  runDueLifecycleAction: vi.fn(),
  startManualPayoutAction: vi.fn(),
  updatePrizeKycAction: vi.fn(),
}));

import AdminPage from './page';

afterEach(cleanup);

describe('admin prize operations browser view', () => {
  it('shows provenance, manual limits, and only the valid processing actions', async () => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
    mocks.getAdminOverview.mockResolvedValue({
      activeAccounts: 0,
      competitions: 1,
      managedCompetitions: [],
      pendingPayments: 0,
      prizeOperations: [
        {
          amountMinor: 500,
          approvedAt: new Date('2026-04-05T12:00:00.000Z'),
          approvedByUserId: 'admin-1',
          competition: {
            code: 'DEV-WEEK-20260330',
            name: 'Prize Operations Week',
            status: 'FINALIZED',
          },
          competitionId: 'competition-1',
          createdAt: new Date('2026-04-04T00:00:00.000Z'),
          currency: 'USD',
          freeEntryCredits: 2,
          id: 'prize-1',
          issuedFreeEntryCredits: [],
          kycReason: 'Evidence reviewed',
          kycReviewedAt: new Date('2026-04-05T11:00:00.000Z'),
          kycReviewedByUserId: 'admin-1',
          kycStatus: 'APPROVED',
          payout: {
            amountMinor: 500,
            approvedAt: new Date('2026-04-05T13:00:00.000Z'),
            approvedByUserId: 'admin-2',
            createdAt: new Date('2026-04-05T12:00:00.000Z'),
            currency: 'USD',
            id: 'payout-1',
            paidAt: null,
            paidByUserId: null,
            prizeId: 'prize-1',
            processingAt: new Date('2026-04-05T14:00:00.000Z'),
            reconciledAt: null,
            reconciledByUserId: null,
            reconciliationNote: null,
            status: 'PROCESSING',
            transactionReference: null,
            updatedAt: new Date('2026-04-05T14:00:00.000Z'),
          },
          rank: 5,
          reviewReason: 'Winner confirmed',
          sourceFinalizationId: 'finalization-1',
          sourceResultHash: 'a'.repeat(64),
          sourceStandingId: 'standing-1',
          status: 'PAYOUT_PENDING',
          tier: { code: 'ROOKIE', name: 'Rookie' },
          tierId: 'tier-1',
          updatedAt: new Date('2026-04-05T14:00:00.000Z'),
          winnerEntry: {
            activatedAt: new Date('2026-03-29T10:00:00.000Z'),
            competitionId: 'competition-1',
            completedAt: new Date('2026-04-03T21:00:00.000Z'),
            createdAt: new Date('2026-03-29T10:00:00.000Z'),
            disqualifiedAt: null,
            id: 'entry-1',
            status: 'COMPLETED',
            tierId: 'tier-1',
            updatedAt: new Date('2026-04-03T21:00:00.000Z'),
            user: {
              displayName: 'Verified Trader',
              email: 'trader@example.test',
              name: null,
            },
            userId: 'trader-1',
          },
          winnerEntryId: 'entry-1',
          winnerReviewedAt: new Date('2026-04-05T10:00:00.000Z'),
          winnerReviewedByUserId: 'admin-1',
          winnerReviewStatus: 'CONFIRMED',
        },
      ],
      recentAudit: [],
      recentPayments: [],
      users: 4,
    });

    render(await AdminPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('Prize operations')).toBeTruthy();
    expect(screen.getByText('Verified Trader')).toBeTruthy();
    expect(screen.getByText(/no provider or customer balance/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Record paid' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Record failed' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve payout' })).toBeNull();
  });
});
