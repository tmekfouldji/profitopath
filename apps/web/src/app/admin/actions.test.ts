import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approvePayout: vi.fn(),
  approvePrize: vi.fn(),
  archiveCompetition: vi.fn(),
  cancelManualPayout: vi.fn(),
  derivePrizeLedger: vi.fn(),
  disqualifyCompetitionEntry: vi.fn(),
  finalizeLeaderboard: vi.fn(),
  markManualPayoutPaid: vi.fn(),
  processCompetitionLifecycle: vi.fn(),
  reconcileManualPayout: vi.fn(),
  recordManualPayoutFailure: vi.fn(),
  recomputeLeaderboardForAdmin: vi.fn(),
  redirect: vi.fn(),
  requireAdmin: vi.fn(),
  reviewPrizeWinner: vi.fn(),
  startManualPayout: vi.fn(),
  updatePrizeKycStatus: vi.fn(),
}));

vi.mock('@profitopath/competition', () => ({
  approvePayout: mocks.approvePayout,
  approvePrize: mocks.approvePrize,
  archiveCompetition: mocks.archiveCompetition,
  cancelManualPayout: mocks.cancelManualPayout,
  CompetitionAdminCommandError: class CompetitionAdminCommandError extends Error {},
  derivePrizeLedger: mocks.derivePrizeLedger,
  disqualifyCompetitionEntry: mocks.disqualifyCompetitionEntry,
  finalizeLeaderboard: mocks.finalizeLeaderboard,
  InvalidStateTransitionError: class InvalidStateTransitionError extends Error {},
  LeaderboardFinalizationError: class LeaderboardFinalizationError extends Error {},
  markManualPayoutPaid: mocks.markManualPayoutPaid,
  PrizeOperationError: class PrizeOperationError extends Error {},
  processCompetitionLifecycle: mocks.processCompetitionLifecycle,
  reconcileManualPayout: mocks.reconcileManualPayout,
  recordManualPayoutFailure: mocks.recordManualPayoutFailure,
  recomputeLeaderboardForAdmin: mocks.recomputeLeaderboardForAdmin,
  reviewPrizeWinner: mocks.reviewPrizeWinner,
  startManualPayout: mocks.startManualPayout,
  updatePrizeKycStatus: mocks.updatePrizeKycStatus,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/server/auth/session', () => ({ requireAdmin: mocks.requireAdmin }));

import {
  approvePayoutAction,
  disqualifyEntryAction,
  finalizeLeaderboardAction,
  runDueLifecycleAction,
} from './actions';
import { CompetitionAdminCommandError } from '@profitopath/competition';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: 'admin-1' });
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
});

describe('admin server actions', () => {
  it('authorizes before running global lifecycle work', async () => {
    mocks.processCompetitionLifecycle.mockResolvedValue({
      activatedCompetitions: 1,
      frozenCompetitions: 0,
    });

    await expect(runDueLifecycleAction()).rejects.toThrow(
      'redirect:/admin?notice=lifecycle-processed',
    );
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.processCompetitionLifecycle).toHaveBeenCalledWith(
      expect.any(Date),
      { actorUserId: 'admin-1' },
    );
  });

  it('passes the authenticated admin and review reason to disqualification', async () => {
    mocks.disqualifyCompetitionEntry.mockResolvedValue({
      alreadyDisqualified: false,
      cancelledOrders: 2,
    });
    const form = new FormData();
    form.set('entryId', 'entry-1');
    form.set('reason', 'Evidence review confirmed a rules violation');

    await expect(disqualifyEntryAction(form)).rejects.toThrow(
      'redirect:/admin?notice=entry-disqualified',
    );
    expect(mocks.disqualifyCompetitionEntry).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      entryId: 'entry-1',
      reason: 'Evidence review confirmed a rules violation',
    });
  });

  it('does not invoke a mutation when admin authorization fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('unauthorized'));
    const form = new FormData();
    form.set('competitionId', 'competition-1');

    await expect(finalizeLeaderboardAction(form)).rejects.toThrow(
      'unauthorized',
    );
    expect(mocks.finalizeLeaderboard).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('fails closed with a stable notice for rejected domain commands', async () => {
    mocks.disqualifyCompetitionEntry.mockRejectedValue(
      new CompetitionAdminCommandError('reason is required'),
    );
    const form = new FormData();
    form.set('entryId', 'entry-1');
    form.set('reason', '');

    await expect(disqualifyEntryAction(form)).rejects.toThrow(
      'redirect:/admin?notice=invalid-operation',
    );
  });

  it('passes only the authenticated admin into payout approval', async () => {
    mocks.approvePayout.mockResolvedValue({ unchanged: false });
    const form = new FormData();
    form.set('payoutId', 'payout-1');
    form.set('reason', 'Second administrator reviewed the exact payout row');

    await expect(approvePayoutAction(form)).rejects.toThrow(
      'redirect:/admin?notice=payout-approved',
    );
    expect(mocks.approvePayout).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      payoutId: 'payout-1',
      reason: 'Second administrator reviewed the exact payout row',
    });
  });
});
