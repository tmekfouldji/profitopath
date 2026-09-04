import { database } from '@profitopath/database';
import {
  MockMarketDataProvider,
  type MockQuoteSeed,
} from '@profitopath/market-data';
import Decimal from 'decimal.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PersistentSimulatedExecutionEngine,
  recoverSimulatorState,
} from './engine';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);

interface Fixture {
  accountId: string;
  competitionId: string;
  entryId: string;
  tierId: string;
  userId: string;
}

const fixtures: Fixture[] = [];
const tradingStart = new Date('2026-08-24T08:00:00.000Z');

async function createFixture(
  maxDrawdownMinor = 100_000n,
  tradingEndsAt = new Date('2026-08-28T17:00:00.000Z'),
): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const fixture = await database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: { email: `simulator-${suffix}@example.test` },
    });
    const tier = await transaction.challengeTier.create({
      data: {
        code: `SIM-${suffix.slice(0, 8)}`,
        entryFeeMinor: 500,
        maxDrawdownMinor,
        name: 'Simulator Test Tier',
        performanceBenchmarkMinor: 200_000n,
        startingBalanceMinor: 1_000_000n,
      },
    });
    const competition = await transaction.competition.create({
      data: {
        code: `SIM-${suffix.slice(9, 17)}`,
        name: 'Simulator Test Week',
        rulesVersion: 1,
        signupClosesAt: new Date('2026-08-24T07:00:00.000Z'),
        status: 'ACTIVE',
        tradingEndsAt,
        tradingStartsAt: tradingStart,
      },
    });
    const entry = await transaction.competitionEntry.create({
      data: {
        activatedAt: tradingStart,
        competitionId: competition.id,
        status: 'ACTIVE',
        tierId: tier.id,
        userId: user.id,
      },
    });
    const account = await transaction.tradingAccount.create({
      data: {
        balanceMinor: 1_000_000n,
        competitionEntryId: entry.id,
        configVersion: 1,
        startingBalanceMinor: 1_000_000n,
        status: 'ACTIVE',
      },
    });
    await transaction.accountBalanceLedgerEntry.create({
      data: {
        amountMinor: 1_000_000n,
        balanceAfterMinor: 1_000_000n,
        idempotencyKey: `simulator-initial:${suffix}`,
        occurredAt: tradingStart,
        tradingAccountId: account.id,
        type: 'INITIAL_BALANCE',
      },
    });
    return {
      accountId: account.id,
      competitionId: competition.id,
      entryId: entry.id,
      tierId: tier.id,
      userId: user.id,
    };
  });
  fixtures.push(fixture);
  return fixture;
}

async function createEngine(seeds: readonly MockQuoteSeed[]) {
  const provider = new MockMarketDataProvider(seeds);
  await provider.subscribe(['EURUSD']);
  await provider.publishNext();
  return { engine: new PersistentSimulatedExecutionEngine(provider), provider };
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.$transaction(async (transaction) => {
      await transaction.auditEvent.deleteMany({
        where: { actorUserId: fixture.userId },
      });
      await transaction.ruleBreach.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.accountSnapshot.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.accountBalanceLedgerEntry.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.closedTrade.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.order.updateMany({
        data: { protectedPositionId: null },
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.position.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.execution.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.order.deleteMany({
        where: { tradingAccountId: fixture.accountId },
      });
      await transaction.tradingAccount.delete({
        where: { id: fixture.accountId },
      });
      await transaction.competitionEntry.delete({
        where: { id: fixture.entryId },
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

integrationTest('persistent simulated execution engine', () => {
  it('fills one market order exactly once across client retries', async () => {
    const fixture = await createFixture();
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);
    const command = {
      clientOrderId: 'open-long-1',
      quantity: new Decimal('0.10'),
      side: 'BUY' as const,
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    };

    const first = await engine.submitMarketOrder(command);
    const retry = await engine.submitMarketOrder(command);
    const account = await database.tradingAccount.findUniqueOrThrow({
      include: {
        executions: true,
        orders: true,
        positions: true,
        snapshots: true,
      },
      where: { id: fixture.accountId },
    });

    expect(first).toEqual(retry);
    expect(first.status).toBe('FILLED');
    expect(account.orders).toHaveLength(1);
    expect(account.executions).toHaveLength(1);
    expect(account.positions).toHaveLength(1);
    expect(account.positions[0]).toMatchObject({
      instrumentVersion: 1,
      side: 'LONG',
      status: 'OPEN',
      symbol: 'EURUSD',
    });
    expect(account.positions[0]?.quantity.toString()).toBe('0.1');
    expect(account.positions[0]?.averageEntryPrice.toString()).toBe('1.1002');
    expect(account.snapshots).toHaveLength(1);
  });

  it('persists quantity and insufficient-margin rejections without executions', async () => {
    const fixture = await createFixture();
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);

    const invalidStep = await engine.submitMarketOrder({
      clientOrderId: 'invalid-step',
      quantity: new Decimal('0.015'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const insufficientMargin = await engine.submitMarketOrder({
      clientOrderId: 'insufficient-margin',
      quantity: new Decimal('100'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });

    expect(invalidStep).toMatchObject({
      rejectionReason: 'Quantity does not match the step',
      status: 'REJECTED',
    });
    expect(insufficientMargin).toMatchObject({
      rejectionReason: 'Insufficient free margin',
      status: 'REJECTED',
    });
    await expect(
      database.order.count({ where: { tradingAccountId: fixture.accountId } }),
    ).resolves.toBe(2);
    await expect(
      database.execution.count({
        where: { tradingAccountId: fixture.accountId },
      }),
    ).resolves.toBe(0);
  });

  it('reduces then reverses a net position with exact trades and ledger effects', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.10120',
        bid: '1.10100',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
      {
        ask: '1.10220',
        bid: '1.10200',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:02.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'net-open',
      quantity: new Decimal('1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    await provider.publishNext();
    await engine.submitMarketOrder({
      clientOrderId: 'net-reduce',
      quantity: new Decimal('0.4'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:01.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    await provider.publishNext();
    await engine.submitMarketOrder({
      clientOrderId: 'net-reverse',
      quantity: new Decimal('0.8'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:02.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });

    const account = await database.tradingAccount.findUniqueOrThrow({
      include: {
        balanceLedgerEntries: { orderBy: { occurredAt: 'asc' } },
        closedTrades: { orderBy: { closedAt: 'asc' } },
        positions: { orderBy: { openedAt: 'asc' } },
      },
      where: { id: fixture.accountId },
    });
    expect(account.balanceMinor).toBe(1_014_000n);
    expect(account.realizedPnlMinor).toBe(14_000n);
    expect(
      account.closedTrades.map((trade) => trade.realizedPnl.toString()),
    ).toEqual(['32', '108']);
    expect(
      account.balanceLedgerEntries.map((entry) => entry.amountMinor),
    ).toEqual([1_000_000n, 3_200n, 10_800n]);
    expect(account.balanceLedgerEntries.map((entry) => entry.type)).toEqual([
      'INITIAL_BALANCE',
      'REALIZED_PNL',
      'REALIZED_PNL',
    ]);
    expect(account.positions).toHaveLength(2);
    expect(account.positions[0]?.status).toBe('CLOSED');
    expect(account.positions[1]?.status).toBe('OPEN');
    expect(account.positions[1]?.side).toBe('SHORT');
    expect(account.positions[1]?.quantity.toString()).toBe('0.2');
  });

  it('snapshots duplicate quotes once and breaches at the exact static boundary offline', async () => {
    const fixture = await createFixture(100_000n);
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'risk-open',
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const harmlessQuote = {
      ask: new Decimal('1.1002'),
      bid: new Decimal('1.1000'),
      sequence: 10n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:01.000Z'),
    };
    const firstMark = await engine.markToMarket(harmlessQuote);
    const duplicateMark = await engine.markToMarket(harmlessQuote);
    const breachMark = await engine.markToMarket({
      ask: new Decimal('1.0004'),
      bid: new Decimal('1.0002'),
      sequence: 11n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:02.000Z'),
    });

    expect(firstMark.snapshottedAccounts).toBe(1);
    expect(duplicateMark.duplicateAccounts).toBe(1);
    expect(breachMark.breachedAccounts).toBe(1);
    const account = await database.tradingAccount.findUniqueOrThrow({
      include: {
        competitionEntry: true,
        ruleBreaches: true,
        snapshots: { orderBy: { sequence: 'asc' } },
      },
      where: { id: fixture.accountId },
    });
    expect(account.status).toBe('BREACHED');
    expect(account.competitionEntry.status).toBe('BREACHED');
    expect(account.ruleBreaches).toHaveLength(1);
    expect(account.ruleBreaches[0]).toMatchObject({
      observedMinor: 100_000n,
      thresholdMinor: 100_000n,
      type: 'MAX_DRAWDOWN',
    });
    expect(account.snapshots).toHaveLength(3);
    expect(account.snapshots[2]?.equityMinor).toBe(900_000n);
  });

  it('fills accepted limit and stop orders once at executable quote prices', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.09940',
        bid: '1.09920',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
      {
        ask: '1.09900',
        bid: '1.09880',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:02.000Z'),
      },
    ]);
    const limit = await engine.submitPendingOrder({
      clientOrderId: 'buy-limit',
      price: new Decimal('1.09950'),
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    expect(limit.status).toBe('ACCEPTED');
    const limitQuote = await provider.publishNext();
    const firstProcess = await engine.processQuote(limitQuote!);
    const duplicateProcess = await engine.processQuote(limitQuote!);
    expect(firstProcess.filledOrders).toBe(1);
    expect(duplicateProcess.filledOrders).toBe(0);

    const stop = await engine.submitPendingOrder({
      clientOrderId: 'sell-stop',
      price: new Decimal('1.09900'),
      quantity: new Decimal('0.1'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:01.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'STOP',
    });
    expect(stop.status).toBe('ACCEPTED');
    const stopQuote = await provider.publishNext();
    await engine.processQuote(stopQuote!);

    const orders = await database.order.findMany({
      include: { executions: true },
      orderBy: { submittedAt: 'asc' },
      where: { tradingAccountId: fixture.accountId },
    });
    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.status)).toEqual(['FILLED', 'FILLED']);
    expect(orders.map((order) => order.triggerQuoteSequence)).toEqual([2n, 3n]);
    expect(
      orders.map((order) => order.executions[0]?.price.toString()),
    ).toEqual(['1.0994', '1.0988']);
  });

  it('cancels accepted orders idempotently and never fills them afterward', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.09900',
        bid: '1.09880',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
    ]);
    const pending = await engine.submitPendingOrder({
      clientOrderId: 'cancel-limit',
      price: new Decimal('1.09910'),
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    const command = {
      cancelledAt: new Date('2026-08-24T09:00:00.750Z'),
      orderId: pending.orderId,
      tradingAccountId: fixture.accountId,
    };
    await expect(engine.cancelOrder(command)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    await expect(engine.cancelOrder(command)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    await engine.processQuote((await provider.publishNext())!);
    await expect(
      database.execution.count({
        where: { tradingAccountId: fixture.accountId },
      }),
    ).resolves.toBe(0);
  });

  it('expires a triggered order when free margin is insufficient', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.09900',
        bid: '1.09880',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
    ]);
    const pending = await engine.submitPendingOrder({
      clientOrderId: 'margin-limit',
      price: new Decimal('1.09910'),
      quantity: new Decimal('100'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    expect(pending.status).toBe('ACCEPTED');
    const result = await engine.processQuote((await provider.publishNext())!);
    expect(result.expiredOrders).toBe(1);
    await expect(
      database.order.findUniqueOrThrow({ where: { id: pending.orderId } }),
    ).resolves.toMatchObject({
      status: 'EXPIRED',
      terminalReason: 'Insufficient free margin at trigger',
    });
  });

  it('fills stop loss at a gap quote and cancels its take-profit sibling', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.09820',
        bid: '1.09800',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'protected-open',
      quantity: new Decimal('1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const position = await database.position.findFirstOrThrow({
      where: { status: 'OPEN', tradingAccountId: fixture.accountId },
    });
    const protectionCommand = {
      clientRequestId: 'protect-long-1',
      positionId: position.id,
      stopLossPrice: new Decimal('1.09900'),
      submittedAt: new Date('2026-08-24T09:00:00.600Z'),
      takeProfitPrice: new Decimal('1.10200'),
      tradingAccountId: fixture.accountId,
    };
    const protection = await engine.setPositionProtection(protectionCommand);
    await expect(
      engine.setPositionProtection(protectionCommand),
    ).resolves.toEqual(protection);
    const result = await engine.processQuote((await provider.publishNext())!);
    expect(result.filledOrders).toBe(1);

    const orders = await database.order.findMany({
      include: { executions: true },
      where: { protectedPositionId: position.id },
    });
    const stopLoss = orders.find((order) => order.type === 'STOP_LOSS')!;
    const takeProfit = orders.find((order) => order.type === 'TAKE_PROFIT')!;
    expect(stopLoss.status).toBe('FILLED');
    expect(stopLoss.executions[0]?.price.toString()).toBe('1.098');
    expect(takeProfit.status).toBe('CANCELLED');
    await expect(
      database.position.findUniqueOrThrow({ where: { id: position.id } }),
    ).resolves.toMatchObject({ status: 'CLOSED' });
  });

  it('fills short take profit on ask and cancels its stop-loss sibling', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.09880',
        bid: '1.09860',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'protected-short-open',
      quantity: new Decimal('1'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const position = await database.position.findFirstOrThrow({
      where: { status: 'OPEN', tradingAccountId: fixture.accountId },
    });
    await engine.setPositionProtection({
      clientRequestId: 'protect-short-1',
      positionId: position.id,
      stopLossPrice: new Decimal('1.10200'),
      submittedAt: new Date('2026-08-24T09:00:00.600Z'),
      takeProfitPrice: new Decimal('1.09900'),
      tradingAccountId: fixture.accountId,
    });
    await engine.processQuote((await provider.publishNext())!);

    const orders = await database.order.findMany({
      include: { executions: true },
      where: { protectedPositionId: position.id },
    });
    const stopLoss = orders.find((order) => order.type === 'STOP_LOSS')!;
    const takeProfit = orders.find((order) => order.type === 'TAKE_PROFIT')!;
    expect(takeProfit.status).toBe('FILLED');
    expect(takeProfit.executions[0]?.price.toString()).toBe('1.0988');
    expect(stopLoss.status).toBe('CANCELLED');
  });

  it('reconciles full-position protection after a manual reduction and close', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
      {
        ask: '1.10120',
        bid: '1.10100',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:01.000Z'),
      },
      {
        ask: '1.10220',
        bid: '1.10200',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:02.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'reconcile-open',
      quantity: new Decimal('1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const position = await database.position.findFirstOrThrow({
      where: { status: 'OPEN', tradingAccountId: fixture.accountId },
    });
    await engine.setPositionProtection({
      clientRequestId: 'reconcile-protection',
      positionId: position.id,
      stopLossPrice: new Decimal('1.09900'),
      submittedAt: new Date('2026-08-24T09:00:00.600Z'),
      takeProfitPrice: new Decimal('1.10300'),
      tradingAccountId: fixture.accountId,
    });
    await provider.publishNext();
    await engine.submitMarketOrder({
      clientOrderId: 'reconcile-reduce',
      quantity: new Decimal('0.4'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:01.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const reducedProtection = await database.order.findMany({
      where: { protectedPositionId: position.id, status: 'ACCEPTED' },
    });
    expect(reducedProtection.map((order) => order.quantity.toString())).toEqual(
      ['0.6', '0.6'],
    );
    await provider.publishNext();
    await engine.submitMarketOrder({
      clientOrderId: 'reconcile-close',
      quantity: new Decimal('0.6'),
      side: 'SELL',
      submittedAt: new Date('2026-08-24T09:00:02.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });
    const terminalProtection = await database.order.findMany({
      where: { protectedPositionId: position.id },
    });
    expect(terminalProtection.map((order) => order.status)).toEqual([
      'CANCELLED',
      'CANCELLED',
    ]);
  });

  it('recovers accepted orders, ignores weekend triggers, and expires at cutoff', async () => {
    const fixture = await createFixture(
      100_000n,
      new Date('2026-08-31T17:00:00.000Z'),
    );
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-28T16:00:00.000Z'),
      },
    ]);
    const pending = await engine.submitPendingOrder({
      clientOrderId: 'weekend-limit',
      price: new Decimal('1.09900'),
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-28T16:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    const recovery = await recoverSimulatorState(
      new Date('2026-08-28T16:00:01.000Z'),
    );
    expect(
      recovery.accounts.find((account) => account.id === fixture.accountId)
        ?.activeOrders,
    ).toHaveLength(1);
    await engine.processQuote({
      ask: new Decimal('1.09890'),
      bid: new Decimal('1.09870'),
      sequence: 2n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-29T09:00:00.000Z'),
    });
    await expect(
      database.order.findUniqueOrThrow({ where: { id: pending.orderId } }),
    ).resolves.toMatchObject({ status: 'ACCEPTED' });
    await engine.processQuote({
      ask: new Decimal('1.09890'),
      bid: new Decimal('1.09870'),
      sequence: 3n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-31T17:00:00.000Z'),
    });
    await expect(
      database.order.findUniqueOrThrow({ where: { id: pending.orderId } }),
    ).resolves.toMatchObject({
      status: 'EXPIRED',
      terminalReason: 'Competition trading window ended',
    });
  });

  it('serializes a trigger/cancel race to one terminal outcome', async () => {
    const fixture = await createFixture();
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);
    const pending = await engine.submitPendingOrder({
      clientOrderId: 'race-limit',
      price: new Decimal('1.09900'),
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    const triggerQuote = {
      ask: new Decimal('1.09890'),
      bid: new Decimal('1.09870'),
      sequence: 2n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:01.000Z'),
    };
    await Promise.all([
      engine.processQuote(triggerQuote),
      engine.cancelOrder({
        cancelledAt: triggerQuote.timestamp,
        orderId: pending.orderId,
        tradingAccountId: fixture.accountId,
      }),
    ]);
    const order = await database.order.findUniqueOrThrow({
      where: { id: pending.orderId },
    });
    expect(['CANCELLED', 'FILLED']).toContain(order.status);
    await expect(
      database.execution.count({ where: { orderId: order.id } }),
    ).resolves.toBe(order.status === 'FILLED' ? 1 : 0);
  });

  it('recovers open server-owned positions without browser or local disk state', async () => {
    const fixture = await createFixture();
    const { engine } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);
    await engine.submitMarketOrder({
      clientOrderId: 'recovery-open',
      quantity: new Decimal('0.25'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
    });

    const recovered = await recoverSimulatorState(
      new Date('2026-08-24T09:05:00.000Z'),
    );
    const account = recovered.accounts.find(
      (candidate) => candidate.id === fixture.accountId,
    );

    expect(account?.openPositions).toEqual([
      {
        averageEntryPrice: '1.1002',
        instrumentVersion: 1,
        quantity: '0.25',
        side: 'LONG',
        symbol: 'EURUSD',
      },
    ]);
  });

  it('does not mark or trigger non-staff accounts when worker quote processing is staff-scoped', async () => {
    const fixture = await createFixture();
    const { engine, provider } = await createEngine([
      {
        ask: '1.10020',
        bid: '1.10000',
        symbol: 'EURUSD',
        timestamp: new Date('2026-08-24T09:00:00.000Z'),
      },
    ]);
    const pending = await engine.submitPendingOrder({
      clientOrderId: 'staff-only-limit',
      price: new Decimal('1.09900'),
      quantity: new Decimal('0.1'),
      side: 'BUY',
      submittedAt: new Date('2026-08-24T09:00:00.500Z'),
      symbol: 'EURUSD',
      tradingAccountId: fixture.accountId,
      type: 'LIMIT',
    });
    const staffScopedEngine = new PersistentSimulatedExecutionEngine(provider, {
      accountScope: {
        competitionEntry: {
          user: { role: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' },
        },
      },
    });
    const trigger = {
      ask: new Decimal('1.09890'),
      bid: new Decimal('1.09870'),
      sequence: 2n,
      symbol: 'EURUSD',
      timestamp: new Date('2026-08-24T09:00:01.000Z'),
    };

    await staffScopedEngine.processQuote(trigger);
    await expect(
      database.order.findUniqueOrThrow({ where: { id: pending.orderId } }),
    ).resolves.toMatchObject({ status: 'ACCEPTED' });

    await database.user.update({
      data: { role: 'ADMIN' },
      where: { id: fixture.userId },
    });
    await staffScopedEngine.processQuote({ ...trigger, sequence: 3n });
    await expect(
      database.order.findUniqueOrThrow({ where: { id: pending.orderId } }),
    ).resolves.toMatchObject({ status: 'FILLED' });
  });
});
