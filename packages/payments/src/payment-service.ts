import { createHash } from 'node:crypto';

import {
  assertStateTransition,
  competitionEntryTransitions,
  paymentTransitions,
  tradingAccountTransitions,
  type CompetitionEntryState,
  type PaymentState,
  type TradingAccountState,
} from '@profitopath/competition';
import { database, type Prisma } from '@profitopath/database';

import type {
  CheckoutSession,
  PaymentEvent,
  PaymentProvider,
  PaymentProviderName,
} from './index';

export class CheckoutUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutUnavailableError';
  }
}

export class PaymentEventConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentEventConflictError';
  }
}

export interface CreateCompetitionCheckoutInput {
  competitionId: string;
  now?: Date;
  tierId: string;
  userId: string;
}

export interface CompetitionCheckout {
  checkout: CheckoutSession;
  competitionEntryId: string;
  paymentId: string;
}

export interface ProcessPaymentEventInput {
  event: PaymentEvent;
  payloadHash: string;
  receivedAt?: Date;
}

export interface ProcessPaymentEventResult {
  alreadyProcessed: boolean;
  competitionEntryId: string;
  paymentId: string;
  status: PaymentState;
  tradingAccountId?: string;
}

function checkoutIdempotencyKey(
  provider: PaymentProviderName,
  entryId: string,
): string {
  return `${provider.toLowerCase()}-checkout:${entryId}`;
}

function initialBalanceIdempotencyKey(entryId: string): string {
  return `initial-balance:${entryId}`;
}

async function upsertAudit(
  transaction: Prisma.TransactionClient,
  data: Prisma.AuditEventUncheckedCreateInput & { idempotencyKey: string },
): Promise<void> {
  await transaction.auditEvent.upsert({
    create: data,
    update: {},
    where: { idempotencyKey: data.idempotencyKey },
  });
}

export function hashPaymentEvent(event: PaymentEvent): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        amountMinor: event.amountMinor,
        currency: event.currency,
        orderReferenceId: event.orderReferenceId,
        providerEventId: event.providerEventId,
        provider: event.provider,
        providerInvoiceId: event.providerInvoiceId,
        providerPaymentId: event.providerPaymentId,
        status: event.status,
      }),
    )
    .digest('hex');
}

export function getOwnedMockPayment(providerPaymentId: string, userId: string) {
  return database.payment.findFirst({
    include: {
      competitionEntry: {
        include: { competition: true, tier: true, tradingAccount: true },
      },
    },
    where: { provider: 'MOCK', providerPaymentId, userId },
  });
}

function persistedCheckout(payment: {
  checkoutUrl: string | null;
  expiresAt: Date | null;
  providerInvoiceId: string | null;
  providerPaymentId: string | null;
}): CheckoutSession | undefined {
  if (
    payment.checkoutUrl === null ||
    (payment.providerInvoiceId === null && payment.providerPaymentId === null)
  ) {
    return undefined;
  }
  return {
    ...(payment.expiresAt === null ? {} : { expiresAt: payment.expiresAt }),
    ...(payment.providerInvoiceId === null
      ? {}
      : { providerInvoiceId: payment.providerInvoiceId }),
    providerPaymentId: payment.providerPaymentId ?? payment.providerInvoiceId!,
    redirectUrl: payment.checkoutUrl,
  };
}

export async function createCompetitionCheckout(
  input: CreateCompetitionCheckoutInput,
  provider: PaymentProvider,
): Promise<CompetitionCheckout> {
  const now = input.now ?? new Date();
  const reservation = await database.$transaction(async (transaction) => {
    const [user, competition, tier] = await Promise.all([
      transaction.user.findUnique({ where: { id: input.userId } }),
      transaction.competition.findUnique({
        where: { id: input.competitionId },
      }),
      transaction.challengeTier.findUnique({ where: { id: input.tierId } }),
    ]);

    if (user === null || user.status !== 'ACTIVE') {
      throw new CheckoutUnavailableError('Active trader account required');
    }
    if (competition === null || competition.status !== 'SCHEDULED') {
      throw new CheckoutUnavailableError('Competition is not open for signup');
    }
    if (now >= competition.signupClosesAt) {
      throw new CheckoutUnavailableError('Competition signup has closed');
    }
    if (tier === null || !tier.active || tier.currency !== 'USD') {
      throw new CheckoutUnavailableError('Competition tier is unavailable');
    }

    const entry = await transaction.competitionEntry.upsert({
      create: {
        competitionId: competition.id,
        tierId: tier.id,
        userId: user.id,
      },
      update: {},
      where: {
        userId_competitionId_tierId: {
          competitionId: competition.id,
          tierId: tier.id,
          userId: user.id,
        },
      },
    });

    if (entry.status !== 'PENDING_PAYMENT') {
      throw new CheckoutUnavailableError(
        'This competition entry has already been provisioned',
      );
    }

    const idempotencyKey = checkoutIdempotencyKey(provider.provider, entry.id);
    const payment = await transaction.payment.upsert({
      create: {
        amountMinor: tier.entryFeeMinor,
        competitionEntryId: entry.id,
        currency: 'USD',
        idempotencyKey,
        metadata: {
          competitionId: competition.id,
          competitionRulesVersion: competition.rulesVersion,
          startingBalanceMinor: tier.startingBalanceMinor.toString(),
          tierId: tier.id,
          tierRulesVersion: tier.rulesVersion,
        },
        provider: provider.provider,
        userId: user.id,
      },
      update: {},
      where: { idempotencyKey },
    });

    if (
      payment.userId !== user.id ||
      payment.competitionEntryId !== entry.id ||
      payment.amountMinor !== tier.entryFeeMinor ||
      payment.currency !== tier.currency ||
      payment.provider !== provider.provider
    ) {
      throw new PaymentEventConflictError(
        'Persisted checkout does not match the requested entry',
      );
    }
    if (payment.status !== 'CREATED' && payment.status !== 'PENDING') {
      throw new CheckoutUnavailableError('Checkout is no longer payable');
    }

    await upsertAudit(transaction, {
      action: 'CHECKOUT_RESERVED',
      actorUserId: user.id,
      after: {
        amountMinor: payment.amountMinor,
        competitionEntryId: entry.id,
        currency: payment.currency,
        status: payment.status,
      },
      entityId: payment.id,
      entityType: 'Payment',
      idempotencyKey: `audit:checkout-reserved:${payment.id}`,
    });

    return { entryId: entry.id, payment };
  });

  const existingCheckout = persistedCheckout(reservation.payment);
  const checkout =
    existingCheckout ??
    (await provider.createCheckout({
      amountMinor: reservation.payment.amountMinor,
      currency: 'USD',
      idempotencyKey: reservation.payment.idempotencyKey,
      referenceId: reservation.payment.id,
    }));

  await database.$transaction(async (transaction) => {
    const current = await transaction.payment.findUniqueOrThrow({
      where: { id: reservation.payment.id },
    });
    if (
      checkout.providerInvoiceId === undefined &&
      current.providerPaymentId !== null &&
      current.providerPaymentId !== checkout.providerPaymentId
    ) {
      throw new PaymentEventConflictError(
        'Provider returned a different payment for an existing checkout',
      );
    }
    if (
      checkout.providerInvoiceId !== undefined &&
      current.providerInvoiceId !== null &&
      current.providerInvoiceId !== checkout.providerInvoiceId
    ) {
      throw new PaymentEventConflictError(
        'Provider returned a different invoice for an existing checkout',
      );
    }

    if (current.status === 'CREATED') {
      assertStateTransition(
        'Payment',
        paymentTransitions,
        current.status,
        'PENDING',
      );
      await transaction.payment.update({
        data: {
          checkoutUrl: checkout.redirectUrl,
          expiresAt: checkout.expiresAt ?? null,
          ...(checkout.providerInvoiceId === undefined
            ? {}
            : { providerInvoiceId: checkout.providerInvoiceId }),
          ...(checkout.providerInvoiceId === undefined
            ? { providerPaymentId: checkout.providerPaymentId }
            : {}),
          status: 'PENDING',
        },
        where: { id: current.id },
      });
    } else if (current.status === 'PENDING') {
      await transaction.payment.update({
        data: {
          checkoutUrl: checkout.redirectUrl,
          expiresAt: checkout.expiresAt ?? null,
          ...(checkout.providerInvoiceId === undefined
            ? {}
            : { providerInvoiceId: checkout.providerInvoiceId }),
          ...(checkout.providerInvoiceId === undefined
            ? { providerPaymentId: checkout.providerPaymentId }
            : {}),
        },
        where: { id: current.id },
      });
    } else {
      throw new CheckoutUnavailableError('Checkout is no longer payable');
    }

    await upsertAudit(transaction, {
      action: 'CHECKOUT_CREATED',
      actorUserId: input.userId,
      after: {
        expiresAt: checkout.expiresAt?.toISOString(),
        providerInvoiceId: checkout.providerInvoiceId,
        providerPaymentId: checkout.providerPaymentId,
        status: 'PENDING',
      },
      before: { status: current.status },
      entityId: current.id,
      entityType: 'Payment',
      idempotencyKey: `audit:checkout-created:${current.id}`,
    });
  });

  return {
    checkout,
    competitionEntryId: reservation.entryId,
    paymentId: reservation.payment.id,
  };
}

export async function processVerifiedPaymentEvent(
  input: ProcessPaymentEventInput,
): Promise<ProcessPaymentEventResult> {
  if (!/^[a-f0-9]{64}$/.test(input.payloadHash)) {
    throw new PaymentEventConflictError(
      'Payment event payload hash is invalid',
    );
  }
  const receivedAt = input.receivedAt ?? new Date();

  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT 1 AS "locked"
      FROM (
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`${input.event.provider}:${input.event.providerEventId}`},
            0
          )
        )
      ) AS payment_event_lock
    `;
    const existingEvent = await transaction.paymentProviderEvent.findUnique({
      include: {
        payment: {
          include: {
            competitionEntry: { include: { tradingAccount: true } },
          },
        },
      },
      where: {
        provider_providerEventId: {
          provider: input.event.provider,
          providerEventId: input.event.providerEventId,
        },
      },
    });
    if (existingEvent !== null) {
      if (
        existingEvent.payloadHash !== input.payloadHash ||
        existingEvent.providerPaymentId !== input.event.providerPaymentId ||
        existingEvent.status !== input.event.status
      ) {
        throw new PaymentEventConflictError(
          'Provider event ID was reused with different content',
        );
      }
      const entry = existingEvent.payment.competitionEntry;
      if (entry === null) {
        throw new PaymentEventConflictError('Payment has no competition entry');
      }
      return {
        alreadyProcessed: true,
        competitionEntryId: entry.id,
        paymentId: existingEvent.payment.id,
        status: existingEvent.payment.status,
        ...(entry.tradingAccount === null
          ? {}
          : { tradingAccountId: entry.tradingAccount.id }),
      };
    }

    const payment = await transaction.payment.findFirst({
      include: {
        competitionEntry: {
          include: { tier: true, tradingAccount: true },
        },
      },
      where: {
        provider: input.event.provider,
        OR: [
          { providerPaymentId: input.event.providerPaymentId },
          ...(input.event.orderReferenceId === undefined
            ? []
            : [{ id: input.event.orderReferenceId }]),
        ],
      },
    });
    if (payment === null || payment.competitionEntry === null) {
      throw new PaymentEventConflictError('Payment was not found');
    }
    if (
      input.event.orderReferenceId !== undefined &&
      payment.id !== input.event.orderReferenceId
    ) {
      throw new PaymentEventConflictError(
        'Provider order reference does not match',
      );
    }
    if (
      input.event.providerInvoiceId !== undefined &&
      payment.providerInvoiceId !== input.event.providerInvoiceId
    ) {
      throw new PaymentEventConflictError(
        'Provider invoice reference does not match',
      );
    }
    if (
      payment.providerPaymentId !== null &&
      payment.providerPaymentId !== input.event.providerPaymentId
    ) {
      throw new PaymentEventConflictError(
        'Provider payment reference does not match',
      );
    }
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${`competition-lifecycle:${payment.competitionEntry.competitionId}`},
          0
        )
      )
    `;
    const competition = await transaction.competition.findUniqueOrThrow({
      select: { status: true },
      where: { id: payment.competitionEntry.competitionId },
    });
    if (
      input.event.status === 'CONFIRMED' &&
      competition.status !== 'SCHEDULED' &&
      competition.status !== 'ACTIVE'
    ) {
      throw new PaymentEventConflictError(
        'Competition no longer accepts entry activation',
      );
    }
    if (
      payment.amountMinor !== input.event.amountMinor ||
      payment.currency !== input.event.currency ||
      payment.amountMinor !== payment.competitionEntry.tier.entryFeeMinor
    ) {
      throw new PaymentEventConflictError(
        'Confirmed payment amount is invalid',
      );
    }

    const nextStatus = input.event.status satisfies PaymentState;
    if (payment.status !== nextStatus) {
      assertStateTransition(
        'Payment',
        paymentTransitions,
        payment.status,
        nextStatus,
      );
    }

    await transaction.paymentProviderEvent.create({
      data: {
        payloadHash: input.payloadHash,
        paymentId: payment.id,
        provider: input.event.provider,
        providerEventId: input.event.providerEventId,
        providerPaymentId: input.event.providerPaymentId,
        receivedAt,
        status: nextStatus,
      },
    });

    if (payment.status !== nextStatus || payment.providerPaymentId === null) {
      await transaction.payment.update({
        data: {
          ...(nextStatus === 'CONFIRMED' ? { confirmedAt: receivedAt } : {}),
          providerPaymentId: input.event.providerPaymentId,
          status: nextStatus,
        },
        where: { id: payment.id },
      });
      if (payment.status !== nextStatus) {
        await upsertAudit(transaction, {
          action: 'PAYMENT_STATUS_CHANGED',
          actorUserId: payment.userId,
          after: { status: nextStatus },
          before: { status: payment.status },
          correlationId: input.event.providerEventId,
          entityId: payment.id,
          entityType: 'Payment',
          idempotencyKey: `audit:payment-event:${input.event.providerEventId}`,
        });
      }
    }

    const entry = payment.competitionEntry;
    let tradingAccount = entry.tradingAccount;
    if (nextStatus === 'CONFIRMED') {
      if (entry.status === 'PENDING_PAYMENT') {
        assertStateTransition(
          'CompetitionEntry',
          competitionEntryTransitions,
          entry.status satisfies CompetitionEntryState,
          'ACTIVE',
        );
        await transaction.competitionEntry.update({
          data: { activatedAt: receivedAt, status: 'ACTIVE' },
          where: { id: entry.id },
        });
      } else if (entry.status !== 'ACTIVE') {
        throw new PaymentEventConflictError(
          'Competition entry cannot be activated',
        );
      }

      if (tradingAccount === null) {
        tradingAccount = await transaction.tradingAccount.create({
          data: {
            balanceMinor: entry.tier.startingBalanceMinor,
            competitionEntryId: entry.id,
            configVersion: entry.tier.rulesVersion,
            currency: entry.tier.currency,
            startingBalanceMinor: entry.tier.startingBalanceMinor,
            status: 'ACTIVE',
          },
        });
      } else if (tradingAccount.status === 'PENDING') {
        assertStateTransition(
          'TradingAccount',
          tradingAccountTransitions,
          tradingAccount.status satisfies TradingAccountState,
          'ACTIVE',
        );
        tradingAccount = await transaction.tradingAccount.update({
          data: { status: 'ACTIVE' },
          where: { id: tradingAccount.id },
        });
      } else if (tradingAccount.status !== 'ACTIVE') {
        throw new PaymentEventConflictError(
          'Trading account cannot be activated',
        );
      }

      await transaction.accountBalanceLedgerEntry.upsert({
        create: {
          amountMinor: tradingAccount.startingBalanceMinor,
          balanceAfterMinor: tradingAccount.startingBalanceMinor,
          idempotencyKey: initialBalanceIdempotencyKey(entry.id),
          occurredAt: receivedAt,
          referenceId: payment.id,
          referenceType: 'Payment',
          tradingAccountId: tradingAccount.id,
          type: 'INITIAL_BALANCE',
        },
        update: {},
        where: { idempotencyKey: initialBalanceIdempotencyKey(entry.id) },
      });

      await Promise.all([
        upsertAudit(transaction, {
          action: 'ENTRY_ACTIVATED',
          actorUserId: payment.userId,
          after: { activatedAt: receivedAt.toISOString(), status: 'ACTIVE' },
          before: { status: entry.status },
          correlationId: input.event.providerEventId,
          entityId: entry.id,
          entityType: 'CompetitionEntry',
          idempotencyKey: `audit:entry-activated:${entry.id}`,
        }),
        upsertAudit(transaction, {
          action: 'TRADING_ACCOUNT_PROVISIONED',
          actorUserId: payment.userId,
          after: {
            balanceMinor: tradingAccount.startingBalanceMinor.toString(),
            configVersion: tradingAccount.configVersion,
            status: tradingAccount.status,
          },
          correlationId: input.event.providerEventId,
          entityId: tradingAccount.id,
          entityType: 'TradingAccount',
          idempotencyKey: `audit:account-provisioned:${tradingAccount.id}`,
        }),
      ]);
    }

    return {
      alreadyProcessed: false,
      competitionEntryId: entry.id,
      paymentId: payment.id,
      status: nextStatus,
      ...(tradingAccount === null
        ? {}
        : { tradingAccountId: tradingAccount.id }),
    };
  });
}
