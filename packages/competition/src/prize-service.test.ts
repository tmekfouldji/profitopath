import { describe, expect, it } from 'vitest';

import {
  approvePayout,
  approvePrize,
  cancelManualPayout,
  derivePrizeLedger,
  markManualPayoutPaid,
  PrizeOperationError,
  reconcileManualPayout,
  recordManualPayoutFailure,
  reviewPrizeWinner,
  startManualPayout,
  updatePrizeKycStatus,
} from './prize-service';

describe('prize operation validation', () => {
  it('requires auditable reasons before storage access', async () => {
    await expect(
      derivePrizeLedger({
        actorUserId: 'admin-1',
        competitionId: 'competition-1',
        reason: ' ',
      }),
    ).rejects.toThrow(PrizeOperationError);
    await expect(
      reviewPrizeWinner({
        actorUserId: 'admin-1',
        decision: 'CONFIRM',
        prizeId: 'prize-1',
        reason: 'x',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      updatePrizeKycStatus({
        actorUserId: 'admin-1',
        kycStatus: 'PENDING',
        prizeId: 'prize-1',
        reason: '',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      approvePrize({
        actorUserId: 'admin-1',
        prizeId: 'prize-1',
        reason: 'no',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      approvePayout({
        actorUserId: 'admin-2',
        payoutId: 'payout-1',
        reason: ' ',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      startManualPayout({
        actorUserId: 'admin-2',
        payoutId: 'payout-1',
        reason: 'x',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      reconcileManualPayout({
        actorUserId: 'admin-3',
        note: 'x',
        payoutId: 'payout-1',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      recordManualPayoutFailure({
        actorUserId: 'admin-2',
        payoutId: 'payout-1',
        reason: 'x',
      }),
    ).rejects.toThrow('at least 3 characters');
    await expect(
      cancelManualPayout({
        actorUserId: 'admin-2',
        payoutId: 'payout-1',
        reason: 'x',
      }),
    ).rejects.toThrow('at least 3 characters');
  });

  it('rejects short manual transaction references before storage access', async () => {
    await expect(
      markManualPayoutPaid({
        actorUserId: 'admin-2',
        payoutId: 'payout-1',
        reason: 'Manual transfer completed',
        transactionReference: 'tiny',
      }),
    ).rejects.toThrow('at least 6 characters');
  });
});
