import { createHash } from 'node:crypto';

import {
  assertStateTransition,
  competitionEntryTransitions,
  orderTransitions,
  tradingAccountTransitions,
} from '@profitopath/competition';
import { database, type Prisma } from '@profitopath/database';
import {
  assertValidQuote,
  normalizeSymbol,
  type MarketDataProvider,
  type Quote,
} from '@profitopath/market-data';
import Decimal from 'decimal.js';

import {
  applyMarketFill,
  assertValidOrderQuantity,
  calculateAccountMetrics,
  calculateNotional,
  calculatePnl,
  marketFillPrice,
  type AccountingInstrument,
  type PositionWithQuote,
  type TradeSide,
} from './accounting';

export interface SubmitMarketOrderCommand {
  clientOrderId: string;
  quantity: Decimal;
  side: TradeSide;
  submittedAt?: Date;
  symbol: string;
  tradingAccountId: string;
}

export interface SubmitMarketOrderResult {
  executionId?: string;
  orderId: string;
  rejectionReason?: string;
  status: 'FILLED' | 'REJECTED';
}

export interface MarkToMarketResult {
  breachedAccounts: number;
  duplicateAccounts: number;
  snapshottedAccounts: number;
}

export interface SimulatorRecoveryState {
  accounts: Array<{
    id: string;
    openPositions: Array<{
      averageEntryPrice: string;
      instrumentVersion: number;
      quantity: string;
      side: 'LONG' | 'SHORT';
      symbol: string;
    }>;
  }>;
  recoveredAt: Date;
}

export class SimulatorCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulatorCommandError';
  }
}

export class MarketOrderConflictError extends SimulatorCommandError {
  constructor() {
    super('Client order ID was reused with different order content');
    this.name = 'MarketOrderConflictError';
  }
}

export class UnknownInstrumentError extends SimulatorCommandError {
  constructor(symbol: string) {
    super(`No active instrument configuration exists for ${symbol}`);
    this.name = 'UnknownInstrumentError';
  }
}

function toInstrument(configuration: {
  contractSize: { toString(): string };
  leverage: { toString(): string };
  minimumQuantity: { toString(): string };
  quantityStep: { toString(): string };
  symbol: string;
  version: number;
}): AccountingInstrument {
  return {
    contractSize: new Decimal(configuration.contractSize.toString()),
    leverage: new Decimal(configuration.leverage.toString()),
    minimumQuantity: new Decimal(configuration.minimumQuantity.toString()),
    quantityStep: new Decimal(configuration.quantityStep.toString()),
    symbol: configuration.symbol,
    version: configuration.version,
  };
}

async function lockAccount(
  transaction: Prisma.TransactionClient,
  accountId: string,
): Promise<void> {
  await transaction.$queryRaw`
    SELECT 1 AS "locked"
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${`simulator:${accountId}`}, 0))
    ) AS simulator_account_lock
  `;
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

function quoteIsFresh(quote: Quote, now: Date, maxQuoteAgeMs: number): boolean {
  const age = now.getTime() - quote.timestamp.getTime();
  return age >= -1_000 && age <= maxQuoteAgeMs;
}

function eventDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

async function rejectOrder(
  transaction: Prisma.TransactionClient,
  order: { id: string; submittedAt: Date },
  actorUserId: string,
  reason: string,
): Promise<SubmitMarketOrderResult> {
  assertStateTransition('Order', orderTransitions, 'PENDING', 'REJECTED');
  await transaction.order.update({
    data: {
      completedAt: order.submittedAt,
      rejectionReason: reason,
      status: 'REJECTED',
    },
    where: { id: order.id },
  });
  await upsertAudit(transaction, {
    action: 'MARKET_ORDER_REJECTED',
    actorUserId,
    after: { rejectionReason: reason, status: 'REJECTED' },
    before: { status: 'PENDING' },
    entityId: order.id,
    entityType: 'Order',
    idempotencyKey: `audit:order-rejected:${order.id}`,
    reason,
  });
  return { orderId: order.id, rejectionReason: reason, status: 'REJECTED' };
}

async function loadPositionQuotes(
  provider: MarketDataProvider,
  positions: Array<{ symbol: string }>,
  targetQuote: Quote,
  now: Date,
  maxQuoteAgeMs: number,
): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>([[targetQuote.symbol, targetQuote]]);
  for (const position of positions) {
    if (!quotes.has(position.symbol)) {
      const quote = await provider.getLatestQuote(position.symbol);
      assertValidQuote(quote);
      if (!quoteIsFresh(quote, now, maxQuoteAgeMs)) {
        throw new SimulatorCommandError(
          `Quote is stale for ${position.symbol}`,
        );
      }
      quotes.set(position.symbol, quote);
    }
  }
  return quotes;
}

async function persistSnapshotAndMaybeBreach(
  transaction: Prisma.TransactionClient,
  input: {
    account: {
      competitionEntryId: string;
      id: string;
      startingBalanceMinor: bigint;
      status: string;
    };
    actorUserId: string;
    asOf: Date;
    balanceMinor: bigint;
    maxDrawdownLimitMinor: bigint;
    metrics: ReturnType<typeof calculateAccountMetrics>;
    sourceEventId: string;
  },
): Promise<{ breached: boolean; duplicate: boolean }> {
  const existing = await transaction.accountSnapshot.findUnique({
    where: { sourceEventId: input.sourceEventId },
  });
  if (existing !== null) {
    return { breached: false, duplicate: true };
  }
  const latest = await transaction.accountSnapshot.findFirst({
    orderBy: { sequence: 'desc' },
    where: { tradingAccountId: input.account.id },
  });
  const currentDrawdown =
    input.metrics.equityMinor < input.account.startingBalanceMinor
      ? input.account.startingBalanceMinor - input.metrics.equityMinor
      : 0n;
  const maximumObservedDrawdown =
    latest !== null && latest.maxDrawdownMinor > currentDrawdown
      ? latest.maxDrawdownMinor
      : currentDrawdown;
  await transaction.accountSnapshot.create({
    data: {
      asOf: input.asOf,
      balanceMinor: input.balanceMinor,
      dataVersion: 1,
      equityMinor: input.metrics.equityMinor,
      marginFreeMinor: input.metrics.marginFreeMinor,
      marginUsedMinor: input.metrics.marginUsedMinor,
      maxDrawdownMinor: maximumObservedDrawdown,
      sequence: (latest?.sequence ?? 0n) + 1n,
      sourceEventId: input.sourceEventId,
      tradingAccountId: input.account.id,
      unrealizedPnlMinor: input.metrics.unrealizedPnlMinor,
    },
  });

  const breached = currentDrawdown >= input.maxDrawdownLimitMinor;
  if (!breached || input.account.status !== 'ACTIVE') {
    return { breached: false, duplicate: false };
  }
  const breachSource = `drawdown:${input.account.id}:${eventDigest(input.sourceEventId)}`;
  await transaction.ruleBreach.upsert({
    create: {
      details: {
        mode: 'STATIC_INITIAL_BALANCE',
        snapshot: input.sourceEventId,
      },
      occurredAt: input.asOf,
      observedMinor: currentDrawdown,
      rulesVersion: 1,
      sourceEventId: breachSource,
      thresholdMinor: input.maxDrawdownLimitMinor,
      tradingAccountId: input.account.id,
      type: 'MAX_DRAWDOWN',
    },
    update: {},
    where: { sourceEventId: breachSource },
  });
  assertStateTransition(
    'TradingAccount',
    tradingAccountTransitions,
    'ACTIVE',
    'BREACHED',
  );
  assertStateTransition(
    'CompetitionEntry',
    competitionEntryTransitions,
    'ACTIVE',
    'BREACHED',
  );
  await transaction.tradingAccount.update({
    data: { breachedAt: input.asOf, status: 'BREACHED' },
    where: { id: input.account.id },
  });
  await transaction.competitionEntry.update({
    data: { completedAt: input.asOf, status: 'BREACHED' },
    where: { id: input.account.competitionEntryId },
  });
  await upsertAudit(transaction, {
    action: 'MAX_DRAWDOWN_BREACHED',
    actorUserId: input.actorUserId,
    after: {
      observedMinor: currentDrawdown.toString(),
      status: 'BREACHED',
      thresholdMinor: input.maxDrawdownLimitMinor.toString(),
    },
    before: { status: 'ACTIVE' },
    correlationId: input.sourceEventId,
    entityId: input.account.id,
    entityType: 'TradingAccount',
    idempotencyKey: `audit:drawdown:${input.account.id}:${eventDigest(input.sourceEventId)}`,
  });
  return { breached: true, duplicate: false };
}

export class PersistentSimulatedExecutionEngine {
  readonly #maxQuoteAgeMs: number;
  readonly #provider: MarketDataProvider;

  constructor(
    provider: MarketDataProvider,
    options: { maxQuoteAgeMs?: number } = {},
  ) {
    this.#provider = provider;
    this.#maxQuoteAgeMs = options.maxQuoteAgeMs ?? 5_000;
  }

  async submitMarketOrder(
    command: SubmitMarketOrderCommand,
  ): Promise<SubmitMarketOrderResult> {
    const submittedAt = command.submittedAt ?? new Date();
    const symbol = normalizeSymbol(command.symbol);
    const targetQuote = await this.#provider.getLatestQuote(symbol);
    assertValidQuote(targetQuote);
    if (normalizeSymbol(targetQuote.symbol) !== symbol) {
      throw new SimulatorCommandError(
        'Market-data symbol does not match order',
      );
    }

    return database.$transaction(async (transaction) => {
      await lockAccount(transaction, command.tradingAccountId);
      const existingOrder = await transaction.order.findUnique({
        include: { executions: true },
        where: {
          tradingAccountId_clientOrderId: {
            clientOrderId: command.clientOrderId,
            tradingAccountId: command.tradingAccountId,
          },
        },
      });
      if (existingOrder !== null) {
        if (
          existingOrder.symbol !== symbol ||
          existingOrder.side !== command.side ||
          existingOrder.type !== 'MARKET' ||
          !new Decimal(existingOrder.quantity.toString()).equals(
            command.quantity,
          )
        ) {
          throw new MarketOrderConflictError();
        }
        return {
          ...(existingOrder.executions[0] === undefined
            ? {}
            : { executionId: existingOrder.executions[0].id }),
          orderId: existingOrder.id,
          ...(existingOrder.rejectionReason === null
            ? {}
            : { rejectionReason: existingOrder.rejectionReason }),
          status: existingOrder.status === 'FILLED' ? 'FILLED' : 'REJECTED',
        };
      }

      const [account, configuration] = await Promise.all([
        transaction.tradingAccount.findUnique({
          include: {
            competitionEntry: {
              include: { competition: true, tier: true },
            },
            positions: {
              include: { instrumentConfiguration: true },
              where: { status: 'OPEN' },
            },
          },
          where: { id: command.tradingAccountId },
        }),
        transaction.instrumentConfiguration.findFirst({
          where: { active: true, symbol },
        }),
      ]);
      if (account === null) {
        throw new SimulatorCommandError('Trading account was not found');
      }
      if (configuration === null) {
        throw new UnknownInstrumentError(symbol);
      }
      const instrument = toInstrument(configuration);
      const order = await transaction.order.create({
        data: {
          clientOrderId: command.clientOrderId,
          instrumentVersion: configuration.version,
          quantity: command.quantity.toString(),
          requestedPrice: marketFillPrice(command.side, targetQuote).toString(),
          side: command.side,
          status: 'PENDING',
          submittedAt,
          symbol,
          tradingAccountId: account.id,
          type: 'MARKET',
        },
      });
      await upsertAudit(transaction, {
        action: 'MARKET_ORDER_SUBMITTED',
        actorUserId: account.competitionEntry.userId,
        after: {
          quantity: command.quantity.toString(),
          side: command.side,
          status: 'PENDING',
          symbol,
        },
        entityId: order.id,
        entityType: 'Order',
        idempotencyKey: `audit:order-submitted:${order.id}`,
      });

      if (
        account.status !== 'ACTIVE' ||
        account.competitionEntry.status !== 'ACTIVE'
      ) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Trading account is not active',
        );
      }
      const competition = account.competitionEntry.competition;
      if (
        competition.status !== 'ACTIVE' ||
        submittedAt < competition.tradingStartsAt ||
        submittedAt > competition.tradingEndsAt
      ) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Competition trading window is closed',
        );
      }
      if (!quoteIsFresh(targetQuote, submittedAt, this.#maxQuoteAgeMs)) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Market quote is stale',
        );
      }
      try {
        assertValidOrderQuantity(command.quantity, instrument);
      } catch (error) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          error instanceof Error ? error.message : 'Order quantity is invalid',
        );
      }

      const quotes = await loadPositionQuotes(
        this.#provider,
        account.positions,
        targetQuote,
        submittedAt,
        this.#maxQuoteAgeMs,
      );
      const currentPosition = account.positions.find(
        (position) => position.symbol === symbol,
      );
      const fillPrice = marketFillPrice(command.side, targetQuote);
      const mutation = applyMarketFill(
        currentPosition === undefined
          ? null
          : {
              averageEntryPrice: new Decimal(
                currentPosition.averageEntryPrice.toString(),
              ),
              quantity: new Decimal(currentPosition.quantity.toString()),
              side: currentPosition.side,
            },
        command.side,
        command.quantity,
        fillPrice,
        instrument,
      );
      const projectedBalance = account.balanceMinor + mutation.realizedPnlMinor;
      const projectedPositions: PositionWithQuote[] = account.positions
        .filter((position) => position.id !== currentPosition?.id)
        .map((position) => ({
          averageEntryPrice: new Decimal(position.averageEntryPrice.toString()),
          instrument: toInstrument(position.instrumentConfiguration),
          quantity: new Decimal(position.quantity.toString()),
          quote: quotes.get(position.symbol)!,
          side: position.side,
        }));
      if (mutation.nextPosition !== null) {
        projectedPositions.push({
          ...mutation.nextPosition,
          instrument,
          quote: targetQuote,
        });
      }
      const projectedMetrics = calculateAccountMetrics(
        projectedBalance,
        projectedPositions,
      );
      if (projectedMetrics.marginFreeMinor < 0n) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Insufficient free margin',
        );
      }

      assertStateTransition('Order', orderTransitions, 'PENDING', 'ACCEPTED');
      await transaction.order.update({
        data: { acceptedAt: submittedAt, status: 'ACCEPTED' },
        where: { id: order.id },
      });
      const engineEventId = `market:${order.id}:${targetQuote.sequence}`;
      const execution = await transaction.execution.create({
        data: {
          commission: 0,
          engineEventId,
          executedAt: targetQuote.timestamp,
          instrumentVersion: configuration.version,
          notional: calculateNotional(
            command.quantity,
            fillPrice,
            instrument,
          ).toString(),
          orderId: order.id,
          price: fillPrice.toString(),
          quantity: command.quantity.toString(),
          side: command.side,
          symbol,
          tradingAccountId: account.id,
        },
      });

      let affectedPositionId = currentPosition?.id ?? execution.id;
      if (currentPosition === undefined && mutation.nextPosition !== null) {
        const createdPosition = await transaction.position.create({
          data: {
            averageEntryPrice:
              mutation.nextPosition.averageEntryPrice.toString(),
            instrumentVersion: configuration.version,
            openedAt: targetQuote.timestamp,
            openingExecutionId: execution.id,
            quantity: mutation.nextPosition.quantity.toString(),
            side: mutation.nextPosition.side,
            status: 'OPEN',
            symbol,
            tradingAccountId: account.id,
          },
        });
        affectedPositionId = createdPosition.id;
      } else if (currentPosition !== undefined) {
        const rawRealized = calculatePnl(
          currentPosition.side,
          new Decimal(currentPosition.averageEntryPrice.toString()),
          fillPrice,
          mutation.closedQuantity,
          instrument,
        );
        if (mutation.closedQuantity.isPositive()) {
          if (currentPosition.openingExecutionId === null) {
            throw new SimulatorCommandError(
              'Position has no opening execution reference',
            );
          }
          await transaction.closedTrade.create({
            data: {
              closedAt: targetQuote.timestamp,
              closingExecutionId: execution.id,
              commission: 0,
              entryPrice: currentPosition.averageEntryPrice,
              exitPrice: fillPrice.toString(),
              instrumentVersion: configuration.version,
              openedAt: currentPosition.openedAt,
              openingExecutionId: currentPosition.openingExecutionId,
              positionId: currentPosition.id,
              quantity: mutation.closedQuantity.toString(),
              realizedPnl: rawRealized.toString(),
              side: currentPosition.side,
              symbol,
              tradingAccountId: account.id,
            },
          });
        }
        if (mutation.kind === 'REDUCE' && mutation.nextPosition !== null) {
          await transaction.position.update({
            data: {
              quantity: mutation.nextPosition.quantity.toString(),
              realizedPnl: new Decimal(currentPosition.realizedPnl.toString())
                .plus(rawRealized)
                .toString(),
            },
            where: { id: currentPosition.id },
          });
        } else if (mutation.kind === 'CLOSE' || mutation.kind === 'REVERSE') {
          await transaction.position.update({
            data: {
              closedAt: targetQuote.timestamp,
              quantity: 0,
              realizedPnl: new Decimal(currentPosition.realizedPnl.toString())
                .plus(rawRealized)
                .toString(),
              status: 'CLOSED',
            },
            where: { id: currentPosition.id },
          });
          if (mutation.kind === 'REVERSE' && mutation.nextPosition !== null) {
            const reversedPosition = await transaction.position.create({
              data: {
                averageEntryPrice:
                  mutation.nextPosition.averageEntryPrice.toString(),
                instrumentVersion: configuration.version,
                openedAt: targetQuote.timestamp,
                openingExecutionId: execution.id,
                quantity: mutation.nextPosition.quantity.toString(),
                side: mutation.nextPosition.side,
                status: 'OPEN',
                symbol,
                tradingAccountId: account.id,
              },
            });
            affectedPositionId = reversedPosition.id;
          }
        } else if (
          mutation.kind === 'INCREASE' &&
          mutation.nextPosition !== null
        ) {
          await transaction.position.update({
            data: {
              averageEntryPrice:
                mutation.nextPosition.averageEntryPrice.toString(),
              quantity: mutation.nextPosition.quantity.toString(),
            },
            where: { id: currentPosition.id },
          });
        }
      }

      if (mutation.closedQuantity.isPositive()) {
        await transaction.tradingAccount.update({
          data: {
            balanceMinor: projectedBalance,
            realizedPnlMinor:
              account.realizedPnlMinor + mutation.realizedPnlMinor,
          },
          where: { id: account.id },
        });
        await transaction.accountBalanceLedgerEntry.create({
          data: {
            amountMinor: mutation.realizedPnlMinor,
            balanceAfterMinor: projectedBalance,
            idempotencyKey: `realized:${execution.id}`,
            occurredAt: targetQuote.timestamp,
            referenceId: execution.id,
            referenceType: 'Execution',
            tradingAccountId: account.id,
            type: 'REALIZED_PNL',
          },
        });
      }

      assertStateTransition('Order', orderTransitions, 'ACCEPTED', 'FILLED');
      await transaction.order.update({
        data: {
          averageFillPrice: fillPrice.toString(),
          completedAt: targetQuote.timestamp,
          filledQuantity: command.quantity.toString(),
          status: 'FILLED',
        },
        where: { id: order.id },
      });
      await Promise.all([
        upsertAudit(transaction, {
          action: 'MARKET_ORDER_FILLED',
          actorUserId: account.competitionEntry.userId,
          after: {
            executionId: execution.id,
            fillPrice: fillPrice.toString(),
            status: 'FILLED',
          },
          before: { status: 'ACCEPTED' },
          correlationId: engineEventId,
          entityId: order.id,
          entityType: 'Order',
          idempotencyKey: `audit:order-filled:${order.id}`,
        }),
        upsertAudit(transaction, {
          action: `POSITION_${mutation.kind}`,
          actorUserId: account.competitionEntry.userId,
          after: {
            realizedPnlMinor: mutation.realizedPnlMinor.toString(),
            remainingQuantity:
              mutation.nextPosition?.quantity.toString() ?? '0',
          },
          correlationId: engineEventId,
          entityId: affectedPositionId,
          entityType: 'Position',
          idempotencyKey: `audit:position:${execution.id}`,
        }),
      ]);
      await persistSnapshotAndMaybeBreach(transaction, {
        account,
        actorUserId: account.competitionEntry.userId,
        asOf: targetQuote.timestamp,
        balanceMinor: projectedBalance,
        maxDrawdownLimitMinor: account.competitionEntry.tier.maxDrawdownMinor,
        metrics: projectedMetrics,
        sourceEventId: `execution:${execution.id}`,
      });
      return {
        executionId: execution.id,
        orderId: order.id,
        status: 'FILLED',
      };
    });
  }

  async markToMarket(quote: Quote): Promise<MarkToMarketResult> {
    assertValidQuote(quote);
    const symbol = normalizeSymbol(quote.symbol);
    const normalizedQuote = { ...quote, symbol };
    const accounts = await database.tradingAccount.findMany({
      select: { id: true },
      where: {
        positions: { some: { status: 'OPEN', symbol } },
        status: 'ACTIVE',
      },
    });
    const result: MarkToMarketResult = {
      breachedAccounts: 0,
      duplicateAccounts: 0,
      snapshottedAccounts: 0,
    };
    for (const accountRef of accounts) {
      const accountResult = await database.$transaction(async (transaction) => {
        await lockAccount(transaction, accountRef.id);
        const account = await transaction.tradingAccount.findUniqueOrThrow({
          include: {
            competitionEntry: { include: { tier: true } },
            positions: {
              include: { instrumentConfiguration: true },
              where: { status: 'OPEN' },
            },
          },
          where: { id: accountRef.id },
        });
        const quotes = await loadPositionQuotes(
          this.#provider,
          account.positions,
          normalizedQuote,
          normalizedQuote.timestamp,
          this.#maxQuoteAgeMs,
        );
        const metrics = calculateAccountMetrics(
          account.balanceMinor,
          account.positions.map((position) => ({
            averageEntryPrice: new Decimal(
              position.averageEntryPrice.toString(),
            ),
            instrument: toInstrument(position.instrumentConfiguration),
            quantity: new Decimal(position.quantity.toString()),
            quote: quotes.get(position.symbol)!,
            side: position.side,
          })),
        );
        return persistSnapshotAndMaybeBreach(transaction, {
          account,
          actorUserId: account.competitionEntry.userId,
          asOf: normalizedQuote.timestamp,
          balanceMinor: account.balanceMinor,
          maxDrawdownLimitMinor: account.competitionEntry.tier.maxDrawdownMinor,
          metrics,
          sourceEventId: `quote:${account.id}:${symbol}:${normalizedQuote.timestamp.getTime()}:${normalizedQuote.sequence}`,
        });
      });
      if (accountResult.duplicate) {
        result.duplicateAccounts += 1;
      } else {
        result.snapshottedAccounts += 1;
      }
      if (accountResult.breached) {
        result.breachedAccounts += 1;
      }
    }
    return result;
  }
}

export async function recoverSimulatorState(
  recoveredAt = new Date(),
): Promise<SimulatorRecoveryState> {
  const accounts = await database.tradingAccount.findMany({
    include: {
      positions: {
        orderBy: [{ symbol: 'asc' }, { openedAt: 'asc' }],
        where: { status: 'OPEN' },
      },
    },
    orderBy: { id: 'asc' },
    where: { status: 'ACTIVE' },
  });
  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      openPositions: account.positions.map((position) => ({
        averageEntryPrice: position.averageEntryPrice.toString(),
        instrumentVersion: position.instrumentVersion,
        quantity: position.quantity.toString(),
        side: position.side,
        symbol: position.symbol,
      })),
    })),
    recoveredAt,
  };
}
