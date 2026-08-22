import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import { InvalidStateTransitionError } from '@profitopath/competition';

import { MockPaymentProvider } from './mock-provider';
import {
  createCompetitionCheckout,
  getOwnedMockPayment,
  hashPaymentEvent,
  PaymentEventConflictError,
  processVerifiedPaymentEvent,
} from './payment-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);

interface Fixture {
  competitionId: string;
  tierId: string;
  userId: string;
}

const fixtures: Fixture[] = [];

function createProvider(): MockPaymentProvider {
  return new MockPaymentProvider({
    baseUrl: 'http://localhost:3000',
    clock: () => new Date('2026-08-22T12:00:00.000Z'),
    signingSecret: 'integration-test-mock-signing-secret',
  });
}

async function createFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const fixture = await database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: { email: `payment-${suffix}@example.test` },
    });
    const tier = await transaction.challengeTier.create({
      data: {
        code: `PAY-${suffix.slice(0, 8)}`,
        entryFeeMinor: 500,
        maxDrawdownMinor: 100_000n,
        name: 'Payment Test Tier',
        performanceBenchmarkMinor: 200_000n,
        startingBalanceMinor: 1_000_000n,
      },
    });
    const competition = await transaction.competition.create({
      data: {
        code: `PAY-${suffix.slice(9, 17)}`,
        name: 'Payment Test Week',
        rulesVersion: 1,
        signupClosesAt: new Date('2026-08-23T00:00:00.000Z'),
        status: 'SCHEDULED',
        tradingEndsAt: new Date('2026-08-28T23:59:59.000Z'),
        tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
      },
    });
    return {
      competitionId: competition.id,
      tierId: tier.id,
      userId: user.id,
    };
  });
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.$transaction(async (transaction) => {
      await transaction.paymentProviderEvent.deleteMany({
        where: { payment: { userId: fixture.userId } },
      });
      await transaction.accountBalanceLedgerEntry.deleteMany({
        where: {
          tradingAccount: {
            competitionEntry: { userId: fixture.userId },
          },
        },
      });
      await transaction.tradingAccount.deleteMany({
        where: { competitionEntry: { userId: fixture.userId } },
      });
      await transaction.payment.deleteMany({
        where: { userId: fixture.userId },
      });
      await transaction.competitionEntry.deleteMany({
        where: { userId: fixture.userId },
      });
      await transaction.auditEvent.deleteMany({
        where: { actorUserId: fixture.userId },
      });
      await transaction.competition.delete({
        where: { id: fixture.competitionId },
      });
      await transaction.challengeTier.delete({
        where: { id: fixture.tierId },
      });
      await transaction.user.delete({ where: { id: fixture.userId } });
    });
  }
});

integrationTest('mock checkout and provisioning', () => {
  it('rejects ineligible users, competitions, signup windows, and tiers', async () => {
    const provider = createProvider();
    const suspended = await createFixture();
    await database.user.update({
      data: { status: 'SUSPENDED' },
      where: { id: suspended.userId },
    });
    await expect(
      createCompetitionCheckout(
        { ...suspended, now: new Date('2026-08-22T12:00:00.000Z') },
        provider,
      ),
    ).rejects.toThrow('Active trader account required');

    const draft = await createFixture();
    await database.competition.update({
      data: { status: 'DRAFT' },
      where: { id: draft.competitionId },
    });
    await expect(
      createCompetitionCheckout(
        { ...draft, now: new Date('2026-08-22T12:00:00.000Z') },
        provider,
      ),
    ).rejects.toThrow('Competition is not open for signup');

    const closed = await createFixture();
    await expect(
      createCompetitionCheckout(
        { ...closed, now: new Date('2026-08-23T00:00:00.000Z') },
        provider,
      ),
    ).rejects.toThrow('Competition signup has closed');

    const inactive = await createFixture();
    await database.challengeTier.update({
      data: { active: false },
      where: { id: inactive.tierId },
    });
    await expect(
      createCompetitionCheckout(
        { ...inactive, now: new Date('2026-08-22T12:00:00.000Z') },
        provider,
      ),
    ).rejects.toThrow('Competition tier is unavailable');

    await expect(
      database.payment.count({
        where: {
          userId: {
            in: [
              suspended.userId,
              draft.userId,
              closed.userId,
              inactive.userId,
            ],
          },
        },
      }),
    ).resolves.toBe(0);
  });

  it('reuses one checkout, entry, and payment across retries', async () => {
    const fixture = await createFixture();
    const provider = createProvider();

    const first = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:00:00.000Z') },
      provider,
    );
    const second = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:01:00.000Z') },
      provider,
    );

    expect(second).toEqual(first);
    await expect(
      database.competitionEntry.count({ where: { userId: fixture.userId } }),
    ).resolves.toBe(1);
    await expect(
      database.payment.count({ where: { userId: fixture.userId } }),
    ).resolves.toBe(1);
    await expect(
      getOwnedMockPayment(first.checkout.providerPaymentId, fixture.userId),
    ).resolves.not.toBeNull();
    await expect(
      getOwnedMockPayment(
        first.checkout.providerPaymentId,
        crypto.randomUUID(),
      ),
    ).resolves.toBeNull();
  });

  it('provisions one exact account and ledger for duplicate confirmed delivery', async () => {
    const fixture = await createFixture();
    const provider = createProvider();
    const checkout = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:00:00.000Z') },
      provider,
    );
    const callback = provider.createSignedCallback({
      amountMinor: 500,
      currency: 'USD',
      providerPaymentId: checkout.checkout.providerPaymentId,
      status: 'CONFIRMED',
    });
    const event = await provider.verifyCallback(callback);
    const input = {
      event,
      payloadHash: hashPaymentEvent(event),
      receivedAt: new Date('2026-08-22T12:05:00.000Z'),
    };

    const deliveries = await Promise.all([
      processVerifiedPaymentEvent(input),
      processVerifiedPaymentEvent(input),
    ]);
    const first = deliveries.find((delivery) => !delivery.alreadyProcessed);
    const duplicate = deliveries.find((delivery) => delivery.alreadyProcessed);
    expect(first).toBeDefined();
    expect(duplicate).toBeDefined();
    const entry = await database.competitionEntry.findUniqueOrThrow({
      include: {
        payments: { include: { providerEvents: true } },
        tradingAccount: { include: { balanceLedgerEntries: true } },
      },
      where: { id: deliveries[0]!.competitionEntryId },
    });

    expect(first?.alreadyProcessed).toBe(false);
    expect(duplicate?.alreadyProcessed).toBe(true);
    expect(entry.status).toBe('ACTIVE');
    expect(entry.payments[0]?.status).toBe('CONFIRMED');
    expect(entry.payments[0]?.providerEvents).toHaveLength(1);
    expect(entry.tradingAccount?.status).toBe('ACTIVE');
    expect(entry.tradingAccount?.balanceMinor).toBe(1_000_000n);
    expect(entry.tradingAccount?.balanceLedgerEntries).toHaveLength(1);
    expect(entry.tradingAccount?.balanceLedgerEntries[0]).toMatchObject({
      amountMinor: 1_000_000n,
      balanceAfterMinor: 1_000_000n,
      type: 'INITIAL_BALANCE',
    });
  });

  it('rejects late activation after the competition is frozen', async () => {
    const fixture = await createFixture();
    const provider = createProvider();
    const checkout = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:00:00.000Z') },
      provider,
    );
    await database.competition.update({
      data: { status: 'FROZEN' },
      where: { id: fixture.competitionId },
    });
    const callback = provider.createSignedCallback({
      amountMinor: 500,
      currency: 'USD',
      providerPaymentId: checkout.checkout.providerPaymentId,
      status: 'CONFIRMED',
    });
    const event = await provider.verifyCallback(callback);

    await expect(
      processVerifiedPaymentEvent({
        event,
        payloadHash: hashPaymentEvent(event),
      }),
    ).rejects.toThrow('Competition no longer accepts entry activation');
    const entry = await database.competitionEntry.findUniqueOrThrow({
      include: { tradingAccount: true },
      where: { id: checkout.competitionEntryId },
    });
    expect(entry.status).toBe('PENDING_PAYMENT');
    expect(entry.tradingAccount).toBeNull();
    await expect(
      database.paymentProviderEvent.count({
        where: { paymentId: checkout.paymentId },
      }),
    ).resolves.toBe(0);
  });

  it('rejects a mismatched payment amount without persisting a receipt', async () => {
    const fixture = await createFixture();
    const provider = createProvider();
    const checkout = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:00:00.000Z') },
      provider,
    );
    const event = {
      amountMinor: 499,
      currency: 'USD' as const,
      providerEventId: 'mock_evt_mismatched_amount',
      providerPaymentId: checkout.checkout.providerPaymentId,
      status: 'CONFIRMED' as const,
    };

    await expect(
      processVerifiedPaymentEvent({
        event,
        payloadHash: hashPaymentEvent(event),
      }),
    ).rejects.toBeInstanceOf(PaymentEventConflictError);
    await expect(
      database.paymentProviderEvent.count({
        where: { payment: { userId: fixture.userId } },
      }),
    ).resolves.toBe(0);
  });

  it('rolls back the receipt when a terminal payment would regress', async () => {
    const fixture = await createFixture();
    const provider = createProvider();
    const checkout = await createCompetitionCheckout(
      { ...fixture, now: new Date('2026-08-22T12:00:00.000Z') },
      provider,
    );
    await database.payment.update({
      data: { status: 'CANCELLED' },
      where: { id: checkout.paymentId },
    });
    const callback = provider.createSignedCallback({
      amountMinor: 500,
      currency: 'USD',
      providerPaymentId: checkout.checkout.providerPaymentId,
      status: 'CONFIRMED',
    });
    const event = await provider.verifyCallback(callback);

    await expect(
      processVerifiedPaymentEvent({
        event,
        payloadHash: hashPaymentEvent(event),
      }),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
    await expect(
      database.paymentProviderEvent.count({
        where: { paymentId: checkout.paymentId },
      }),
    ).resolves.toBe(0);
    await expect(
      database.auditEvent.count({
        where: { correlationId: event.providerEventId },
      }),
    ).resolves.toBe(0);
  });
});
