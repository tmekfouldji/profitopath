import { database, type Prisma } from '@profitopath/database';

import {
  assertStateTransition,
  payoutTransitions,
  prizeTransitions,
} from './state-machine';

export type WinnerReviewDecision = 'CONFIRM' | 'REJECT';
export type ManualKycStatus =
  'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export class PrizeOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrizeOperationError';
  }
}

function requiredReason(
  reason: string,
  label = 'Administrative reason',
): string {
  const normalized = reason.trim();
  if (normalized.length < 3) {
    throw new PrizeOperationError(
      `${label} must contain at least 3 characters`,
    );
  }
  if (normalized.length > 1000) {
    throw new PrizeOperationError(`${label} cannot exceed 1000 characters`);
  }
  return normalized;
}

function requiredTransactionReference(reference: string): string {
  const normalized = reference.trim();
  if (normalized.length < 6) {
    throw new PrizeOperationError(
      'Transaction reference must contain at least 6 characters',
    );
  }
  if (normalized.length > 255) {
    throw new PrizeOperationError(
      'Transaction reference cannot exceed 255 characters',
    );
  }
  return normalized;
}

function operationTime(value: Date | undefined): Date {
  const timestamp = value ?? new Date();
  if (Number.isNaN(timestamp.getTime())) {
    throw new PrizeOperationError('Operation time is invalid');
  }
  return timestamp;
}

async function lockPrize(
  transaction: Prisma.TransactionClient,
  prizeId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`prize-ops:${prizeId}`}, 0))
  `;
}

async function lockCompetition(
  transaction: Prisma.TransactionClient,
  competitionId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`competition-lifecycle:${competitionId}`}, 0)
    )
  `;
}

function validateConfiguredPrize(prize: {
  amountMinor: number;
  currency: string;
  freeEntryCredits: number;
  rank: number;
}): void {
  if (!Number.isSafeInteger(prize.amountMinor) || prize.amountMinor <= 0) {
    throw new PrizeOperationError(
      'Configured prize amount must be a positive safe integer',
    );
  }
  if (!/^[A-Z]{3}$/.test(prize.currency)) {
    throw new PrizeOperationError(
      'Configured prize currency must be a three-letter uppercase code',
    );
  }
  if (!Number.isSafeInteger(prize.rank) || prize.rank <= 0) {
    throw new PrizeOperationError('Configured prize rank must be positive');
  }
  if (
    !Number.isSafeInteger(prize.freeEntryCredits) ||
    prize.freeEntryCredits < 0
  ) {
    throw new PrizeOperationError(
      'Configured free-entry credit count cannot be negative',
    );
  }
  if (prize.freeEntryCredits > 0 && prize.rank !== 5) {
    throw new PrizeOperationError(
      'Development free-entry credits are restricted to fifth-place prizes',
    );
  }
}

export async function derivePrizeLedger(input: {
  actorUserId: string;
  competitionId: string;
  reason: string;
}): Promise<{
  alreadyDerived: number;
  assigned: number;
  unresolved: number;
}> {
  const reason = requiredReason(input.reason);
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      include: {
        finalization: {
          include: {
            standings: {
              orderBy: [
                { tierId: 'asc' },
                { rank: 'asc' },
                { displayOrder: 'asc' },
              ],
            },
          },
        },
        prizes: { orderBy: [{ tierId: 'asc' }, { rank: 'asc' }] },
      },
      where: { id: input.competitionId },
    });
    if (!['FINALIZED', 'ARCHIVED'].includes(competition.status)) {
      throw new PrizeOperationError(
        'Prize ledger requires a finalized competition',
      );
    }
    if (competition.finalization === null) {
      throw new PrizeOperationError(
        'Prize ledger requires an immutable leaderboard finalization',
      );
    }
    if (competition.prizes.length === 0) {
      throw new PrizeOperationError(
        'No configured prize rows exist; prize economics cannot be invented',
      );
    }

    let alreadyDerived = 0;
    let assigned = 0;
    let unresolved = 0;
    for (const prize of competition.prizes) {
      validateConfiguredPrize(prize);
      const matchingStandings = competition.finalization.standings.filter(
        (standing) =>
          standing.tierId === prize.tierId && standing.rank === prize.rank,
      );
      const standing =
        matchingStandings.length === 1 ? matchingStandings[0] : undefined;
      const unresolvedReason =
        matchingStandings.length === 0
          ? 'No immutable standing exists for this configured tier and rank'
          : matchingStandings.length > 1
            ? 'Multiple immutable standings share this prize rank; allocation policy review is required'
            : undefined;

      if (prize.sourceFinalizationId !== null) {
        if (
          prize.sourceFinalizationId !== competition.finalization.id ||
          prize.sourceResultHash !== competition.finalization.resultHash ||
          prize.sourceStandingId !== (standing?.id ?? null) ||
          prize.winnerEntryId !== (standing?.entryId ?? null)
        ) {
          throw new PrizeOperationError(
            'Existing prize provenance conflicts with immutable standings',
          );
        }
        alreadyDerived += 1;
        continue;
      }
      if (prize.winnerEntryId !== null || prize.sourceStandingId !== null) {
        throw new PrizeOperationError(
          'Configured prize contains winner data without immutable provenance',
        );
      }

      await transaction.prize.update({
        data: {
          reviewReason: unresolvedReason ?? null,
          sourceFinalizationId: competition.finalization.id,
          sourceResultHash: competition.finalization.resultHash,
          sourceStandingId: standing?.id ?? null,
          winnerEntryId: standing?.entryId ?? null,
        },
        where: { id: prize.id },
      });
      await transaction.auditEvent.create({
        data: {
          action:
            standing === undefined
              ? 'PRIZE_AWARD_UNRESOLVED'
              : 'PRIZE_WINNER_DERIVED',
          actorUserId: input.actorUserId,
          after: {
            rank: prize.rank,
            resultHash: competition.finalization.resultHash,
            sourceStandingId: standing?.id ?? null,
            tierId: prize.tierId,
            winnerEntryId: standing?.entryId ?? null,
          },
          before: {
            sourceFinalizationId: null,
            sourceStandingId: null,
            winnerEntryId: null,
          },
          correlationId: `prize-ledger:${competition.id}`,
          entityId: prize.id,
          entityType: 'Prize',
          idempotencyKey: `audit:prize:${prize.id}:derived:v1`,
          reason: unresolvedReason ?? reason,
        },
      });
      if (standing === undefined) unresolved += 1;
      else assigned += 1;
    }
    return { alreadyDerived, assigned, unresolved };
  });
}

export async function reviewPrizeWinner(input: {
  actorUserId: string;
  decision: WinnerReviewDecision;
  prizeId: string;
  reason: string;
  reviewedAt?: Date;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Winner review reason');
  const reviewedAt = operationTime(input.reviewedAt);
  return database.$transaction(async (transaction) => {
    await lockPrize(transaction, input.prizeId);
    const prize = await transaction.prize.findUniqueOrThrow({
      where: { id: input.prizeId },
    });
    const nextReviewStatus =
      input.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
    if (prize.winnerReviewStatus === nextReviewStatus) {
      return { unchanged: true };
    }
    if (prize.winnerReviewStatus !== 'PENDING') {
      throw new PrizeOperationError('Winner review has already been decided');
    }
    if (
      prize.winnerEntryId === null ||
      prize.sourceStandingId === null ||
      prize.sourceFinalizationId === null ||
      prize.sourceResultHash === null
    ) {
      throw new PrizeOperationError(
        'Winner review requires an unambiguous derived prize winner',
      );
    }
    if (input.decision === 'REJECT') {
      assertStateTransition(
        'Prize',
        prizeTransitions,
        prize.status,
        'REJECTED',
      );
    } else if (prize.status !== 'PENDING_REVIEW') {
      throw new PrizeOperationError('Prize is not pending winner review');
    }
    await transaction.prize.update({
      data: {
        reviewReason: reason,
        status: input.decision === 'REJECT' ? 'REJECTED' : prize.status,
        winnerReviewedAt: reviewedAt,
        winnerReviewedByUserId: input.actorUserId,
        winnerReviewStatus: nextReviewStatus,
      },
      where: { id: prize.id },
    });
    await transaction.auditEvent.create({
      data: {
        action:
          input.decision === 'CONFIRM'
            ? 'PRIZE_WINNER_CONFIRMED'
            : 'PRIZE_WINNER_REJECTED',
        actorUserId: input.actorUserId,
        after: {
          prizeStatus: input.decision === 'REJECT' ? 'REJECTED' : prize.status,
          winnerReviewStatus: nextReviewStatus,
        },
        before: {
          prizeStatus: prize.status,
          winnerReviewStatus: prize.winnerReviewStatus,
        },
        correlationId: `prize-review:${prize.id}`,
        entityId: prize.id,
        entityType: 'Prize',
        idempotencyKey: `audit:prize:${prize.id}:winner-${nextReviewStatus.toLowerCase()}:v1`,
        reason,
      },
    });
    return { unchanged: false };
  });
}

const kycTransitions: Readonly<
  Record<ManualKycStatus, readonly ManualKycStatus[]>
> = {
  APPROVED: [],
  NOT_STARTED: ['PENDING'],
  PENDING: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING'],
};

export async function updatePrizeKycStatus(input: {
  actorUserId: string;
  kycStatus: Exclude<ManualKycStatus, 'NOT_STARTED'>;
  prizeId: string;
  reason: string;
  reviewedAt?: Date;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'KYC review reason');
  const reviewedAt = operationTime(input.reviewedAt);
  return database.$transaction(async (transaction) => {
    await lockPrize(transaction, input.prizeId);
    const prize = await transaction.prize.findUniqueOrThrow({
      where: { id: input.prizeId },
    });
    if (prize.kycStatus === input.kycStatus) return { unchanged: true };
    if (prize.winnerReviewStatus !== 'CONFIRMED') {
      throw new PrizeOperationError(
        'KYC review requires a confirmed prize winner',
      );
    }
    if (!kycTransitions[prize.kycStatus].includes(input.kycStatus)) {
      throw new PrizeOperationError(
        `Invalid PrizeKyc state transition: ${prize.kycStatus} -> ${input.kycStatus}`,
      );
    }
    if (prize.status !== 'PENDING_REVIEW') {
      throw new PrizeOperationError('Prize is not pending compliance review');
    }
    await transaction.prize.update({
      data: {
        kycReason: reason,
        kycReviewedAt: reviewedAt,
        kycReviewedByUserId: input.actorUserId,
        kycStatus: input.kycStatus,
      },
      where: { id: prize.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PRIZE_KYC_STATUS_UPDATED',
        actorUserId: input.actorUserId,
        after: { kycStatus: input.kycStatus },
        before: { kycStatus: prize.kycStatus },
        correlationId: `prize-kyc:${prize.id}`,
        entityId: prize.id,
        entityType: 'Prize',
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function approvePrize(input: {
  actorUserId: string;
  approvedAt?: Date;
  prizeId: string;
  reason: string;
}): Promise<{ payoutId: string; unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Prize approval reason');
  const approvedAt = operationTime(input.approvedAt);
  return database.$transaction(async (transaction) => {
    await lockPrize(transaction, input.prizeId);
    const prize = await transaction.prize.findUniqueOrThrow({
      include: { payout: true },
      where: { id: input.prizeId },
    });
    validateConfiguredPrize(prize);
    if (
      ['APPROVED', 'PAYOUT_PENDING', 'PAID'].includes(prize.status) &&
      prize.payout !== null
    ) {
      if (
        prize.payout.amountMinor !== prize.amountMinor ||
        prize.payout.currency !== prize.currency
      ) {
        throw new PrizeOperationError(
          'Existing payout does not match the approved prize',
        );
      }
      return { payoutId: prize.payout.id, unchanged: true };
    }
    if (prize.winnerReviewStatus !== 'CONFIRMED') {
      throw new PrizeOperationError('Prize winner must be confirmed first');
    }
    if (prize.kycStatus !== 'APPROVED') {
      throw new PrizeOperationError('Prize KYC status must be approved first');
    }
    assertStateTransition('Prize', prizeTransitions, prize.status, 'APPROVED');
    if (prize.payout !== null) {
      throw new PrizeOperationError(
        'A payout already exists for a prize that is not approved',
      );
    }
    const payout = await transaction.payout.create({
      data: {
        amountMinor: prize.amountMinor,
        currency: prize.currency,
        prizeId: prize.id,
      },
    });
    await transaction.prize.update({
      data: {
        approvedAt,
        approvedByUserId: input.actorUserId,
        status: 'APPROVED',
      },
      where: { id: prize.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PRIZE_APPROVED',
        actorUserId: input.actorUserId,
        after: {
          amountMinor: prize.amountMinor,
          currency: prize.currency,
          payoutId: payout.id,
          status: 'APPROVED',
        },
        before: { status: prize.status },
        correlationId: `prize-payout:${prize.id}`,
        entityId: prize.id,
        entityType: 'Prize',
        idempotencyKey: `audit:prize:${prize.id}:approved:v1`,
        reason,
      },
    });
    return { payoutId: payout.id, unchanged: false };
  });
}

export async function approvePayout(input: {
  actorUserId: string;
  approvedAt?: Date;
  payoutId: string;
  reason: string;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Payout approval reason');
  const approvedAt = operationTime(input.approvedAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      include: { prize: true },
      where: { id: input.payoutId },
    });
    if (['APPROVED', 'PROCESSING', 'PAID'].includes(payout.status)) {
      if (
        payout.approvedByUserId === null ||
        payout.amountMinor !== payout.prize.amountMinor ||
        payout.currency !== payout.prize.currency
      ) {
        throw new PrizeOperationError(
          'Existing payout approval conflicts with its prize',
        );
      }
      return { unchanged: true };
    }
    if (payout.prize.approvedByUserId === input.actorUserId) {
      throw new PrizeOperationError(
        'Payout approval requires a different administrator from prize approval',
      );
    }
    if (
      payout.prize.status !== 'APPROVED' ||
      payout.amountMinor !== payout.prize.amountMinor ||
      payout.currency !== payout.prize.currency
    ) {
      throw new PrizeOperationError(
        'Pending payout does not exactly match an approved prize',
      );
    }
    assertStateTransition(
      'Payout',
      payoutTransitions,
      payout.status,
      'APPROVED',
    );
    assertStateTransition(
      'Prize',
      prizeTransitions,
      payout.prize.status,
      'PAYOUT_PENDING',
    );
    await transaction.payout.update({
      data: {
        approvedAt,
        approvedByUserId: input.actorUserId,
        status: 'APPROVED',
      },
      where: { id: payout.id },
    });
    await transaction.prize.update({
      data: { status: 'PAYOUT_PENDING' },
      where: { id: payout.prizeId },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_APPROVED',
        actorUserId: input.actorUserId,
        after: { status: 'APPROVED' },
        before: { status: payout.status },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        idempotencyKey: `audit:payout:${payout.id}:approved:v1`,
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function startManualPayout(input: {
  actorUserId: string;
  payoutId: string;
  reason: string;
  startedAt?: Date;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Payout processing reason');
  const startedAt = operationTime(input.startedAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      where: { id: input.payoutId },
    });
    if (payout.status === 'PROCESSING') return { unchanged: true };
    assertStateTransition(
      'Payout',
      payoutTransitions,
      payout.status,
      'PROCESSING',
    );
    await transaction.payout.update({
      data: { processingAt: startedAt, status: 'PROCESSING' },
      where: { id: payout.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_PROCESSING_STARTED',
        actorUserId: input.actorUserId,
        after: { status: 'PROCESSING' },
        before: { status: payout.status },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function recordManualPayoutFailure(input: {
  actorUserId: string;
  failedAt?: Date;
  payoutId: string;
  reason: string;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Payout failure reason');
  const failedAt = operationTime(input.failedAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      where: { id: input.payoutId },
    });
    if (payout.status === 'FAILED') return { unchanged: true };
    assertStateTransition(
      'Payout',
      payoutTransitions,
      payout.status,
      'FAILED',
    );
    await transaction.payout.update({
      data: { status: 'FAILED' },
      where: { id: payout.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_FAILURE_RECORDED',
        actorUserId: input.actorUserId,
        after: { failedAt: failedAt.toISOString(), status: 'FAILED' },
        before: { status: payout.status },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function cancelManualPayout(input: {
  actorUserId: string;
  cancelledAt?: Date;
  payoutId: string;
  reason: string;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Payout cancellation reason');
  const cancelledAt = operationTime(input.cancelledAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      include: { prize: true },
      where: { id: input.payoutId },
    });
    if (payout.status === 'CANCELLED') return { unchanged: true };
    assertStateTransition(
      'Payout',
      payoutTransitions,
      payout.status,
      'CANCELLED',
    );
    assertStateTransition(
      'Prize',
      prizeTransitions,
      payout.prize.status,
      'VOID',
    );
    await transaction.payout.update({
      data: { status: 'CANCELLED' },
      where: { id: payout.id },
    });
    await transaction.prize.update({
      data: { status: 'VOID' },
      where: { id: payout.prizeId },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_CANCELLED',
        actorUserId: input.actorUserId,
        after: {
          cancelledAt: cancelledAt.toISOString(),
          prizeStatus: 'VOID',
          status: 'CANCELLED',
        },
        before: {
          prizeStatus: payout.prize.status,
          status: payout.status,
        },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        idempotencyKey: `audit:payout:${payout.id}:cancelled:v1`,
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function markManualPayoutPaid(input: {
  actorUserId: string;
  paidAt?: Date;
  payoutId: string;
  reason: string;
  transactionReference: string;
}): Promise<{ unchanged: boolean }> {
  const reason = requiredReason(input.reason, 'Payout completion reason');
  const transactionReference = requiredTransactionReference(
    input.transactionReference,
  );
  const paidAt = operationTime(input.paidAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      include: { prize: true },
      where: { id: input.payoutId },
    });
    if (payout.status === 'PAID') {
      if (payout.transactionReference !== transactionReference) {
        throw new PrizeOperationError(
          'Paid payout transaction reference is immutable',
        );
      }
      return { unchanged: true };
    }
    if (
      payout.amountMinor !== payout.prize.amountMinor ||
      payout.currency !== payout.prize.currency
    ) {
      throw new PrizeOperationError('Payout no longer matches its prize');
    }
    assertStateTransition('Payout', payoutTransitions, payout.status, 'PAID');
    assertStateTransition(
      'Prize',
      prizeTransitions,
      payout.prize.status,
      'PAID',
    );
    await transaction.payout.update({
      data: {
        paidAt,
        paidByUserId: input.actorUserId,
        status: 'PAID',
        transactionReference,
      },
      where: { id: payout.id },
    });
    await transaction.prize.update({
      data: { status: 'PAID' },
      where: { id: payout.prizeId },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_RECORDED_PAID',
        actorUserId: input.actorUserId,
        after: { status: 'PAID', transactionReference },
        before: { status: payout.status, transactionReference: null },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        idempotencyKey: `audit:payout:${payout.id}:paid:v1`,
        reason,
      },
    });
    return { unchanged: false };
  });
}

export async function reconcileManualPayout(input: {
  actorUserId: string;
  note: string;
  payoutId: string;
  reconciledAt?: Date;
}): Promise<{ creditsIssued: number; unchanged: boolean }> {
  const note = requiredReason(input.note, 'Reconciliation note');
  const reconciledAt = operationTime(input.reconciledAt);
  return database.$transaction(async (transaction) => {
    const reference = await transaction.payout.findUniqueOrThrow({
      select: { prizeId: true },
      where: { id: input.payoutId },
    });
    await lockPrize(transaction, reference.prizeId);
    const payout = await transaction.payout.findUniqueOrThrow({
      include: {
        prize: {
          include: { winnerEntry: { select: { userId: true } } },
        },
      },
      where: { id: input.payoutId },
    });
    if (payout.reconciledAt !== null) {
      return { creditsIssued: 0, unchanged: true };
    }
    if (
      payout.status !== 'PAID' ||
      payout.transactionReference === null ||
      payout.prize.status !== 'PAID' ||
      payout.amountMinor !== payout.prize.amountMinor ||
      payout.currency !== payout.prize.currency
    ) {
      throw new PrizeOperationError(
        'Only an exact paid prize/payout pair can be reconciled',
      );
    }
    if (payout.paidByUserId === input.actorUserId) {
      throw new PrizeOperationError(
        'Reconciliation requires a different administrator from payout recording',
      );
    }
    if (payout.prize.winnerEntry === null) {
      throw new PrizeOperationError(
        'Reconciliation requires a durable prize winner',
      );
    }
    validateConfiguredPrize(payout.prize);
    const credits = Array.from(
      { length: payout.prize.freeEntryCredits },
      (_, index) => ({
        ordinal: index + 1,
        sourcePrizeId: payout.prize.id,
        userId: payout.prize.winnerEntry?.userId ?? '',
      }),
    );
    if (credits.length > 0) {
      await transaction.freeEntryCredit.createMany({
        data: credits,
        skipDuplicates: true,
      });
    }
    await transaction.payout.update({
      data: {
        reconciledAt,
        reconciledByUserId: input.actorUserId,
        reconciliationNote: note,
      },
      where: { id: payout.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PAYOUT_RECONCILED',
        actorUserId: input.actorUserId,
        after: {
          creditsIssued: credits.length,
          reconciledAt: reconciledAt.toISOString(),
          transactionReference: payout.transactionReference,
        },
        before: { reconciledAt: null },
        correlationId: `prize-payout:${payout.prizeId}`,
        entityId: payout.id,
        entityType: 'Payout',
        idempotencyKey: `audit:payout:${payout.id}:reconciled:v1`,
        reason: note,
      },
    });
    return { creditsIssued: credits.length, unchanged: false };
  });
}
