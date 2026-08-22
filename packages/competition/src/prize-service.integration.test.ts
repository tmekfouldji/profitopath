import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  approvePayout,
  approvePrize,
  cancelManualPayout,
  derivePrizeLedger,
  markManualPayoutPaid,
  reconcileManualPayout,
  recordManualPayoutFailure,
  reviewPrizeWinner,
  startManualPayout,
  updatePrizeKycStatus,
} from './prize-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  competitionId: string;
  tierId: string;
  userIds: string[];
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    const prizes = await database.prize.findMany({
      select: { id: true, payout: { select: { id: true } } },
      where: { competitionId: fixture.competitionId },
    });
    const prizeIds = prizes.map((prize) => prize.id);
    const payoutIds = prizes.flatMap((prize) =>
      prize.payout === null ? [] : [prize.payout.id],
    );
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: fixture.userIds } },
          { entityId: fixture.competitionId },
          { entityId: { in: prizeIds } },
          { entityId: { in: payoutIds } },
        ],
      },
    });
    await database.freeEntryCredit.deleteMany({
      where: { sourcePrizeId: { in: prizeIds } },
    });
    await database.payout.deleteMany({
      where: { prizeId: { in: prizeIds } },
    });
    await database.prize.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardStanding.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.leaderboardFinalization.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.competitionEntry.deleteMany({
      where: { competitionId: fixture.competitionId },
    });
    await database.competition.delete({
      where: { id: fixture.competitionId },
    });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.deleteMany({ where: { id: { in: fixture.userIds } } });
  }
});

async function createFinalizedFixture(input?: { tied?: boolean }) {
  const suffix = crypto.randomUUID();
  return database.$transaction(async (transaction) => {
    const admins = await Promise.all(
      [1, 2, 3].map((index) =>
        transaction.user.create({
          data: {
            email: `prize-admin-${index}-${suffix}@example.test`,
            role: 'ADMIN',
          },
        }),
      ),
    );
    const traders = await Promise.all(
      [1, 2].map((index) =>
        transaction.user.create({
          data: {
            displayName: `Prize Trader ${index}`,
            email: `prize-trader-${index}-${suffix}@example.test`,
          },
        }),
      ),
    );
    const tier = await transaction.challengeTier.create({
      data: {
        code: `PRIZE-${suffix.slice(0, 8)}`,
        entryFeeMinor: 500,
        maxDrawdownMinor: 100_000n,
        name: `Prize tier ${suffix.slice(0, 8)}`,
        performanceBenchmarkMinor: 200_000n,
        startingBalanceMinor: 1_000_000n,
      },
    });
    const competition = await transaction.competition.create({
      data: {
        code: `PRIZE-WEEK-${suffix}`,
        finalizedAt: new Date('2026-04-04T00:00:00.000Z'),
        name: 'Prize Operations Week',
        rulesVersion: 1,
        signupClosesAt: new Date('2026-03-29T20:00:00.000Z'),
        status: 'FINALIZED',
        tradingEndsAt: new Date('2026-04-03T21:00:00.000Z'),
        tradingStartsAt: new Date('2026-03-30T00:00:00.000Z'),
      },
    });
    const entries = await Promise.all(
      traders.map((trader, index) =>
        transaction.competitionEntry.create({
          data: {
            activatedAt: new Date(`2026-03-29T1${index}:00:00.000Z`),
            completedAt: competition.tradingEndsAt,
            competitionId: competition.id,
            status: 'COMPLETED',
            tierId: tier.id,
            userId: trader.id,
          },
        }),
      ),
    );
    const resultHash = 'a'.repeat(64);
    const finalization = await transaction.leaderboardFinalization.create({
      data: {
        competitionId: competition.id,
        finalizedAt: competition.finalizedAt ?? competition.tradingEndsAt,
        result: { fixture: true },
        resultHash,
        rulesVersion: 1,
      },
    });
    const standings = [];
    for (const [index, entry] of entries.entries()) {
      standings.push(
        await transaction.leaderboardStanding.create({
          data: {
            activatedAt: new Date(`2026-03-29T1${index}:00:00.000Z`),
            competitionId: competition.id,
            displayName: `Prize Trader ${index + 1}`,
            displayOrder: index + 1,
            entryId: entry.id,
            equityMinor: 1_100_000n - BigInt(index * 10_000),
            finalScoreReachedAt: competition.tradingEndsAt,
            finalizationId: finalization.id,
            isTied: input?.tied === true,
            maxObservedDrawdownMinor: 20_000n,
            netPerformanceMinor: 100_000n - BigInt(index * 10_000),
            policyVersion: 1,
            rank: input?.tied === true ? 1 : index === 0 ? 1 : 5,
            startingBalanceMinor: 1_000_000n,
            tierId: tier.id,
          },
        }),
      );
    }
    const prize = await transaction.prize.create({
      data: {
        amountMinor: input?.tied === true ? 4000 : 500,
        competitionId: competition.id,
        currency: 'USD',
        freeEntryCredits: input?.tied === true ? 0 : 2,
        rank: input?.tied === true ? 1 : 5,
        tierId: tier.id,
      },
    });
    const fixture = {
      admins,
      competition,
      entries,
      finalization,
      prize,
      standings,
      tier,
      traders,
    };
    fixtures.push({
      competitionId: competition.id,
      tierId: tier.id,
      userIds: [...admins, ...traders].map((user) => user.id),
    });
    return fixture;
  });
}

integrationTest('prize operations', () => {
  it('derives, reviews, approves, records, reconciles, and credits with dual control', async () => {
    const fixture = await createFinalizedFixture();
    const [firstDerivation, replayedDerivation] = await Promise.all([
      derivePrizeLedger({
        actorUserId: fixture.admins[0]?.id ?? '',
        competitionId: fixture.competition.id,
        reason: 'Derive configured awards from the sealed weekly result',
      }),
      derivePrizeLedger({
        actorUserId: fixture.admins[0]?.id ?? '',
        competitionId: fixture.competition.id,
        reason: 'Derive configured awards from the sealed weekly result',
      }),
    ]);
    expect([firstDerivation, replayedDerivation]).toEqual(
      expect.arrayContaining([
        { alreadyDerived: 0, assigned: 1, unresolved: 0 },
        { alreadyDerived: 1, assigned: 0, unresolved: 0 },
      ]),
    );

    const derived = await database.prize.findUniqueOrThrow({
      where: { id: fixture.prize.id },
    });
    expect(derived).toMatchObject({
      sourceFinalizationId: fixture.finalization.id,
      sourceResultHash: fixture.finalization.resultHash,
      sourceStandingId: fixture.standings[1]?.id,
      winnerEntryId: fixture.entries[1]?.id,
    });

    await reviewPrizeWinner({
      actorUserId: fixture.admins[0]?.id ?? '',
      decision: 'CONFIRM',
      prizeId: fixture.prize.id,
      reason: 'Winner identity matches the immutable fifth-place standing',
    });
    await expect(
      updatePrizeKycStatus({
        actorUserId: fixture.admins[0]?.id ?? '',
        kycStatus: 'APPROVED',
        prizeId: fixture.prize.id,
        reason: 'Manual compliance evidence reviewed',
      }),
    ).rejects.toThrow('Invalid PrizeKyc state transition');
    await updatePrizeKycStatus({
      actorUserId: fixture.admins[0]?.id ?? '',
      kycStatus: 'PENDING',
      prizeId: fixture.prize.id,
      reason: 'Manual compliance review opened',
    });
    await updatePrizeKycStatus({
      actorUserId: fixture.admins[0]?.id ?? '',
      kycStatus: 'APPROVED',
      prizeId: fixture.prize.id,
      reason: 'Manual compliance evidence approved',
    });

    const [firstApproval, replayedApproval] = await Promise.all([
      approvePrize({
        actorUserId: fixture.admins[0]?.id ?? '',
        prizeId: fixture.prize.id,
        reason: 'Company-funded prize approved after winner and KYC review',
      }),
      approvePrize({
        actorUserId: fixture.admins[0]?.id ?? '',
        prizeId: fixture.prize.id,
        reason: 'Company-funded prize approved after winner and KYC review',
      }),
    ]);
    expect(
      [firstApproval.unchanged, replayedApproval.unchanged].sort(),
    ).toEqual([false, true]);
    const payoutId = firstApproval.payoutId;
    expect(replayedApproval.payoutId).toBe(payoutId);

    await expect(
      approvePayout({
        actorUserId: fixture.admins[0]?.id ?? '',
        payoutId,
        reason: 'Attempt same-actor approval',
      }),
    ).rejects.toThrow('different administrator');
    await approvePayout({
      actorUserId: fixture.admins[1]?.id ?? '',
      payoutId,
      reason: 'Second administrator approved the exact manual payout',
    });
    await startManualPayout({
      actorUserId: fixture.admins[1]?.id ?? '',
      payoutId,
      reason: 'Manual company transfer initiated outside the platform',
    });
    await recordManualPayoutFailure({
      actorUserId: fixture.admins[1]?.id ?? '',
      payoutId,
      reason: 'Manual transfer attempt failed before settlement',
    });
    await startManualPayout({
      actorUserId: fixture.admins[1]?.id ?? '',
      payoutId,
      reason: 'Manual company transfer retried after failure review',
    });
    await markManualPayoutPaid({
      actorUserId: fixture.admins[1]?.id ?? '',
      payoutId,
      reason: 'Manual company transfer completed and independently evidenced',
      transactionReference: `manual-${crypto.randomUUID()}`,
    });
    await expect(
      reconcileManualPayout({
        actorUserId: fixture.admins[1]?.id ?? '',
        note: 'Attempt self-reconciliation of payout evidence',
        payoutId,
      }),
    ).rejects.toThrow('different administrator');
    expect(
      await reconcileManualPayout({
        actorUserId: fixture.admins[2]?.id ?? '',
        note: 'Second reviewer matched prize, transfer reference, and recipient',
        payoutId,
      }),
    ).toEqual({ creditsIssued: 2, unchanged: false });
    expect(
      await reconcileManualPayout({
        actorUserId: fixture.admins[2]?.id ?? '',
        note: 'Second reviewer matched prize, transfer reference, and recipient',
        payoutId,
      }),
    ).toEqual({ creditsIssued: 0, unchanged: true });

    const [prize, payout, credits, audits] = await Promise.all([
      database.prize.findUniqueOrThrow({ where: { id: fixture.prize.id } }),
      database.payout.findUniqueOrThrow({ where: { id: payoutId } }),
      database.freeEntryCredit.findMany({
        orderBy: { ordinal: 'asc' },
        where: { sourcePrizeId: fixture.prize.id },
      }),
      database.auditEvent.findMany({
        where: {
          OR: [{ entityId: fixture.prize.id }, { entityId: payoutId }],
        },
      }),
    ]);
    expect(prize.status).toBe('PAID');
    expect(payout).toMatchObject({
      amountMinor: prize.amountMinor,
      currency: prize.currency,
      reconciledByUserId: fixture.admins[2]?.id,
      status: 'PAID',
    });
    expect(credits.map((credit) => credit.ordinal)).toEqual([1, 2]);
    expect(credits.every((credit) => credit.status === 'AVAILABLE')).toBe(true);
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        'PRIZE_WINNER_DERIVED',
        'PRIZE_WINNER_CONFIRMED',
        'PRIZE_KYC_STATUS_UPDATED',
        'PRIZE_APPROVED',
        'PAYOUT_APPROVED',
        'PAYOUT_PROCESSING_STARTED',
        'PAYOUT_FAILURE_RECORDED',
        'PAYOUT_RECORDED_PAID',
        'PAYOUT_RECONCILED',
      ]),
    );
  });

  it('cancels an unpaid prize/payout pair with terminal audit evidence', async () => {
    const fixture = await createFinalizedFixture();
    await derivePrizeLedger({
      actorUserId: fixture.admins[0]?.id ?? '',
      competitionId: fixture.competition.id,
      reason: 'Derive configured award before cancellation scenario',
    });
    await reviewPrizeWinner({
      actorUserId: fixture.admins[0]?.id ?? '',
      decision: 'CONFIRM',
      prizeId: fixture.prize.id,
      reason: 'Winner confirmed before compliance review',
    });
    await updatePrizeKycStatus({
      actorUserId: fixture.admins[0]?.id ?? '',
      kycStatus: 'PENDING',
      prizeId: fixture.prize.id,
      reason: 'Manual compliance review opened',
    });
    await updatePrizeKycStatus({
      actorUserId: fixture.admins[0]?.id ?? '',
      kycStatus: 'APPROVED',
      prizeId: fixture.prize.id,
      reason: 'Manual compliance review approved',
    });
    const approval = await approvePrize({
      actorUserId: fixture.admins[0]?.id ?? '',
      prizeId: fixture.prize.id,
      reason: 'Prize approved before payout cancellation review',
    });
    expect(
      await cancelManualPayout({
        actorUserId: fixture.admins[1]?.id ?? '',
        payoutId: approval.payoutId,
        reason: 'Manual payout cancelled with documented operational cause',
      }),
    ).toEqual({ unchanged: false });
    expect(
      await cancelManualPayout({
        actorUserId: fixture.admins[1]?.id ?? '',
        payoutId: approval.payoutId,
        reason: 'Manual payout cancelled with documented operational cause',
      }),
    ).toEqual({ unchanged: true });
    const [prize, payout, audit] = await Promise.all([
      database.prize.findUniqueOrThrow({ where: { id: fixture.prize.id } }),
      database.payout.findUniqueOrThrow({
        where: { id: approval.payoutId },
      }),
      database.auditEvent.findFirstOrThrow({
        where: {
          action: 'PAYOUT_CANCELLED',
          entityId: approval.payoutId,
        },
      }),
    ]);
    expect(prize.status).toBe('VOID');
    expect(payout.status).toBe('CANCELLED');
    expect(audit.actorUserId).toBe(fixture.admins[1]?.id);
  });

  it('retains tied ranks as unresolved without choosing or changing economics', async () => {
    const fixture = await createFinalizedFixture({ tied: true });
    await expect(
      derivePrizeLedger({
        actorUserId: fixture.admins[0]?.id ?? '',
        competitionId: fixture.competition.id,
        reason: 'Derive configured awards from tied sealed standings',
      }),
    ).resolves.toEqual({ alreadyDerived: 0, assigned: 0, unresolved: 1 });
    const prize = await database.prize.findUniqueOrThrow({
      where: { id: fixture.prize.id },
    });
    expect(prize).toMatchObject({
      amountMinor: 4000,
      sourceFinalizationId: fixture.finalization.id,
      sourceResultHash: fixture.finalization.resultHash,
      sourceStandingId: null,
      winnerEntryId: null,
      winnerReviewStatus: 'PENDING',
    });
    await expect(
      reviewPrizeWinner({
        actorUserId: fixture.admins[0]?.id ?? '',
        decision: 'CONFIRM',
        prizeId: fixture.prize.id,
        reason: 'Cannot select one tied participant',
      }),
    ).rejects.toThrow('unambiguous derived prize winner');
  });
});
