'use server';

import {
  approvePayout,
  approvePrize,
  archiveCompetition,
  cancelManualPayout,
  CompetitionAdminCommandError,
  derivePrizeLedger,
  disqualifyCompetitionEntry,
  finalizeLeaderboard,
  InvalidStateTransitionError,
  LeaderboardFinalizationError,
  markManualPayoutPaid,
  PrizeOperationError,
  processCompetitionLifecycle,
  reconcileManualPayout,
  recordManualPayoutFailure,
  recomputeLeaderboardForAdmin,
  reviewPrizeWinner,
  startManualPayout,
  updatePrizeKycStatus,
} from '@profitopath/competition';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/server/auth/session';

function formString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function isExpectedAdminError(error: unknown): boolean {
  return (
    error instanceof CompetitionAdminCommandError ||
    error instanceof InvalidStateTransitionError ||
    error instanceof LeaderboardFinalizationError ||
    error instanceof PrizeOperationError
  );
}

function finish(notice: string): never {
  redirect(`/admin?notice=${encodeURIComponent(notice)}`);
}

export async function runDueLifecycleAction(): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await processCompetitionLifecycle(new Date(), {
      actorUserId: admin.id,
    });
    notice =
      result.activatedCompetitions + result.frozenCompetitions === 0
        ? 'lifecycle-noop'
        : 'lifecycle-processed';
  } catch {
    notice = 'operation-failed';
  }
  finish(notice);
}

export async function recomputeLeaderboardAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await recomputeLeaderboardForAdmin({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
      requestId: crypto.randomUUID(),
    });
    notice = 'leaderboard-recomputed';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function finalizeLeaderboardAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await finalizeLeaderboard({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
    });
    notice = result.alreadyFinalized
      ? 'leaderboard-unchanged'
      : 'leaderboard-finalized';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function disqualifyEntryAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await disqualifyCompetitionEntry({
      actorUserId: admin.id,
      entryId: formString(formData, 'entryId'),
      reason: formString(formData, 'reason'),
    });
    notice = result.alreadyDisqualified
      ? 'entry-unchanged'
      : 'entry-disqualified';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function archiveCompetitionAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await archiveCompetition({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
      reason: formString(formData, 'reason'),
    });
    notice = result.alreadyArchived
      ? 'competition-unchanged'
      : 'competition-archived';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function derivePrizeLedgerAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await derivePrizeLedger({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
      reason: formString(formData, 'reason'),
    });
    notice = result.unresolved > 0 ? 'prizes-unresolved' : 'prizes-derived';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function reviewPrizeWinnerAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const decision = formString(formData, 'decision');
    if (decision !== 'CONFIRM' && decision !== 'REJECT') {
      throw new PrizeOperationError('Winner review decision is invalid');
    }
    await reviewPrizeWinner({
      actorUserId: admin.id,
      decision,
      prizeId: formString(formData, 'prizeId'),
      reason: formString(formData, 'reason'),
    });
    notice = decision === 'CONFIRM' ? 'winner-confirmed' : 'winner-rejected';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function updatePrizeKycAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const kycStatus = formString(formData, 'kycStatus');
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(kycStatus)) {
      throw new PrizeOperationError('KYC status is invalid');
    }
    await updatePrizeKycStatus({
      actorUserId: admin.id,
      kycStatus: kycStatus as 'APPROVED' | 'PENDING' | 'REJECTED',
      prizeId: formString(formData, 'prizeId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'kyc-updated';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function approvePrizeAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await approvePrize({
      actorUserId: admin.id,
      prizeId: formString(formData, 'prizeId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'prize-approved';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function approvePayoutAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await approvePayout({
      actorUserId: admin.id,
      payoutId: formString(formData, 'payoutId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'payout-approved';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function startManualPayoutAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await startManualPayout({
      actorUserId: admin.id,
      payoutId: formString(formData, 'payoutId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'payout-processing';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function recordManualPayoutFailureAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await recordManualPayoutFailure({
      actorUserId: admin.id,
      payoutId: formString(formData, 'payoutId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'payout-failed';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function cancelManualPayoutAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await cancelManualPayout({
      actorUserId: admin.id,
      payoutId: formString(formData, 'payoutId'),
      reason: formString(formData, 'reason'),
    });
    notice = 'payout-cancelled';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function markManualPayoutPaidAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await markManualPayoutPaid({
      actorUserId: admin.id,
      payoutId: formString(formData, 'payoutId'),
      reason: formString(formData, 'reason'),
      transactionReference: formString(formData, 'transactionReference'),
    });
    notice = 'payout-paid';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function reconcileManualPayoutAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await reconcileManualPayout({
      actorUserId: admin.id,
      note: formString(formData, 'reason'),
      payoutId: formString(formData, 'payoutId'),
    });
    notice = 'payout-reconciled';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}
