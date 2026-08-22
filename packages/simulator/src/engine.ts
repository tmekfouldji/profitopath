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
import {
  assertProtectionPricePlacement,
  assertValidOrderPrice,
  isMarketOpen,
  protectionOrderSide,
  shouldTriggerPendingOrder,
  shouldTriggerProtectionOrder,
  type PendingOrderType,
  type ProtectionOrderType,
} from './order-policy';

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

export interface SubmitPendingOrderCommand {
  clientOrderId: string;
  price: Decimal;
  quantity: Decimal;
  side: TradeSide;
  submittedAt?: Date;
  symbol: string;
  tradingAccountId: string;
  type: PendingOrderType;
}

export interface SubmitPendingOrderResult {
  executionId?: string;
  orderId: string;
  rejectionReason?: string;
  status: 'ACCEPTED' | 'FILLED' | 'REJECTED';
}

export interface CancelOrderCommand {
  cancelledAt?: Date;
  orderId: string;
  tradingAccountId: string;
}

export interface CancelOrderResult {
  orderId: string;
  status: 'CANCELLED' | 'EXPIRED' | 'FILLED' | 'REJECTED';
}

export interface SetPositionProtectionCommand {
  clientRequestId: string;
  positionId: string;
  stopLossPrice?: Decimal | null;
  submittedAt?: Date;
  takeProfitPrice?: Decimal | null;
  tradingAccountId: string;
}

export interface SetPositionProtectionResult {
  ocoGroupId?: string;
  positionId: string;
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
}

export interface ProcessQuoteResult extends MarkToMarketResult {
  cancelledProtectionOrders: number;
  expiredOrders: number;
  filledOrders: number;
}

export interface MarkToMarketResult {
  breachedAccounts: number;
  duplicateAccounts: number;
  snapshottedAccounts: number;
}

export interface SimulatorRecoveryState {
  accounts: Array<{
    activeOrders: Array<{
      acceptedAt: Date;
      id: string;
      price: string;
      protectedPositionId: string | null;
      quantity: string;
      side: TradeSide;
      symbol: string;
      type: 'LIMIT' | 'STOP' | 'STOP_LOSS' | 'TAKE_PROFIT';
    }>;
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

export class PendingOrderConflictError extends SimulatorCommandError {
  constructor() {
    super('Client order ID was reused with different order content');
    this.name = 'PendingOrderConflictError';
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
  marketHoursMode: string;
  minimumQuantity: { toString(): string };
  priceScale: number;
  quantityStep: { toString(): string };
  symbol: string;
  version: number;
}): AccountingInstrument {
  return {
    contractSize: new Decimal(configuration.contractSize.toString()),
    leverage: new Decimal(configuration.leverage.toString()),
    marketHoursMode:
      configuration.marketHoursMode === 'UTC_24X5'
        ? 'UTC_24X5'
        : (() => {
            throw new SimulatorCommandError(
              `Unsupported market-hours mode: ${configuration.marketHoursMode}`,
            );
          })(),
    minimumQuantity: new Decimal(configuration.minimumQuantity.toString()),
    priceScale: configuration.priceScale,
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

async function expireAcceptedOrder(
  transaction: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    completedAt: Date;
    orderId: string;
    reason: string;
  },
): Promise<void> {
  assertStateTransition('Order', orderTransitions, 'ACCEPTED', 'EXPIRED');
  await transaction.order.update({
    data: {
      completedAt: input.completedAt,
      status: 'EXPIRED',
      terminalReason: input.reason,
    },
    where: { id: input.orderId },
  });
  await upsertAudit(transaction, {
    action: 'ORDER_EXPIRED',
    actorUserId: input.actorUserId,
    after: { status: 'EXPIRED', terminalReason: input.reason },
    before: { status: 'ACCEPTED' },
    entityId: input.orderId,
    entityType: 'Order',
    idempotencyKey: `audit:order-expired:${input.orderId}`,
    reason: input.reason,
  });
}

async function cancelAcceptedOrder(
  transaction: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    cancelledAt: Date;
    orderId: string;
    reason: string;
  },
): Promise<void> {
  assertStateTransition('Order', orderTransitions, 'ACCEPTED', 'CANCELLED');
  await transaction.order.update({
    data: {
      completedAt: input.cancelledAt,
      status: 'CANCELLED',
      terminalReason: input.reason,
    },
    where: { id: input.orderId },
  });
  await upsertAudit(transaction, {
    action: 'ORDER_CANCELLED',
    actorUserId: input.actorUserId,
    after: { status: 'CANCELLED', terminalReason: input.reason },
    before: { status: 'ACCEPTED' },
    entityId: input.orderId,
    entityType: 'Order',
    idempotencyKey: `audit:order-cancelled:${input.orderId}`,
    reason: input.reason,
  });
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
        submittedAt >= competition.tradingEndsAt
      ) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Competition trading window is closed',
        );
      }
      if (!isMarketOpen(submittedAt, instrument.marketHoursMode)) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          'Instrument market is closed',
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
        if (mutation.closedQuantity.greaterThan(0)) {
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
              stopLossPrice: null,
              takeProfitPrice: null,
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

        if (mutation.kind === 'CLOSE' || mutation.kind === 'REVERSE') {
          const staleProtection = await transaction.order.findMany({
            where: {
              protectedPositionId: currentPosition.id,
              status: 'ACCEPTED',
            },
          });
          for (const protection of staleProtection) {
            await cancelAcceptedOrder(transaction, {
              actorUserId: account.competitionEntry.userId,
              cancelledAt: targetQuote.timestamp,
              orderId: protection.id,
              reason: 'Protected position closed',
            });
          }
        } else if (mutation.nextPosition !== null) {
          await transaction.order.updateMany({
            data: { quantity: mutation.nextPosition.quantity.toString() },
            where: {
              protectedPositionId: currentPosition.id,
              status: 'ACCEPTED',
            },
          });
        }
      }

      if (mutation.closedQuantity.greaterThan(0)) {
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

  async submitPendingOrder(
    command: SubmitPendingOrderCommand,
  ): Promise<SubmitPendingOrderResult> {
    const submittedAt = command.submittedAt ?? new Date();
    const symbol = normalizeSymbol(command.symbol);
    const targetQuote = await this.#provider.getLatestQuote(symbol);
    assertValidQuote(targetQuote);
    if (normalizeSymbol(targetQuote.symbol) !== symbol) {
      throw new SimulatorCommandError(
        'Market-data symbol does not match order',
      );
    }

    const submission = await database.$transaction(async (transaction) => {
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
        const existingPrice =
          existingOrder.type === 'LIMIT'
            ? existingOrder.limitPrice
            : existingOrder.stopPrice;
        if (
          existingOrder.symbol !== symbol ||
          existingOrder.side !== command.side ||
          existingOrder.type !== command.type ||
          !new Decimal(existingOrder.quantity.toString()).equals(
            command.quantity,
          ) ||
          existingPrice === null ||
          !new Decimal(existingPrice.toString()).equals(command.price)
        ) {
          throw new PendingOrderConflictError();
        }
        return {
          ...(existingOrder.executions[0] === undefined
            ? {}
            : { executionId: existingOrder.executions[0].id }),
          orderId: existingOrder.id,
          ...(existingOrder.rejectionReason === null
            ? {}
            : { rejectionReason: existingOrder.rejectionReason }),
          status:
            existingOrder.status === 'FILLED'
              ? ('FILLED' as const)
              : existingOrder.status === 'REJECTED'
                ? ('REJECTED' as const)
                : ('ACCEPTED' as const),
        };
      }

      const [account, configuration] = await Promise.all([
        transaction.tradingAccount.findUnique({
          include: { competitionEntry: { include: { competition: true } } },
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
          ...(command.type === 'LIMIT'
            ? { limitPrice: command.price.toString() }
            : { stopPrice: command.price.toString() }),
          quantity: command.quantity.toString(),
          requestedPrice: command.price.toString(),
          side: command.side,
          status: 'PENDING',
          submittedAt,
          symbol,
          tradingAccountId: account.id,
          type: command.type,
        },
      });
      await upsertAudit(transaction, {
        action: `${command.type}_ORDER_SUBMITTED`,
        actorUserId: account.competitionEntry.userId,
        after: {
          price: command.price.toString(),
          quantity: command.quantity.toString(),
          side: command.side,
          status: 'PENDING',
          symbol,
          type: command.type,
        },
        entityId: order.id,
        entityType: 'Order',
        idempotencyKey: `audit:order-submitted:${order.id}`,
      });

      const competition = account.competitionEntry.competition;
      let rejectionReason: string | null = null;
      if (
        account.status !== 'ACTIVE' ||
        account.competitionEntry.status !== 'ACTIVE'
      ) {
        rejectionReason = 'Trading account is not active';
      } else if (
        competition.status !== 'ACTIVE' ||
        submittedAt < competition.tradingStartsAt ||
        submittedAt >= competition.tradingEndsAt
      ) {
        rejectionReason = 'Competition trading window is closed';
      } else if (!isMarketOpen(submittedAt, instrument.marketHoursMode)) {
        rejectionReason = 'Instrument market is closed';
      } else if (!quoteIsFresh(targetQuote, submittedAt, this.#maxQuoteAgeMs)) {
        rejectionReason = 'Market quote is stale';
      } else {
        try {
          assertValidOrderQuantity(command.quantity, instrument);
          assertValidOrderPrice(command.price, instrument);
        } catch (error) {
          rejectionReason =
            error instanceof Error ? error.message : 'Order is invalid';
        }
      }
      if (rejectionReason !== null) {
        return rejectOrder(
          transaction,
          order,
          account.competitionEntry.userId,
          rejectionReason,
        );
      }

      assertStateTransition('Order', orderTransitions, 'PENDING', 'ACCEPTED');
      await transaction.order.update({
        data: { acceptedAt: submittedAt, status: 'ACCEPTED' },
        where: { id: order.id },
      });
      await upsertAudit(transaction, {
        action: `${command.type}_ORDER_ACCEPTED`,
        actorUserId: account.competitionEntry.userId,
        after: { status: 'ACCEPTED' },
        before: { status: 'PENDING' },
        entityId: order.id,
        entityType: 'Order',
        idempotencyKey: `audit:order-accepted:${order.id}`,
      });
      return { orderId: order.id, status: 'ACCEPTED' as const };
    });

    if (
      submission.status === 'ACCEPTED' &&
      shouldTriggerPendingOrder({
        quote: targetQuote,
        side: command.side,
        triggerPrice: command.price,
        type: command.type,
      })
    ) {
      await this.processPendingOrders(targetQuote);
      const triggered = await database.order.findUniqueOrThrow({
        include: { executions: true },
        where: { id: submission.orderId },
      });
      if (triggered.status === 'FILLED') {
        return {
          executionId: triggered.executions[0]!.id,
          orderId: triggered.id,
          status: 'FILLED',
        };
      }
    }
    return submission;
  }

  async cancelOrder(command: CancelOrderCommand): Promise<CancelOrderResult> {
    const cancelledAt = command.cancelledAt ?? new Date();
    return database.$transaction(async (transaction) => {
      await lockAccount(transaction, command.tradingAccountId);
      const order = await transaction.order.findFirst({
        include: { tradingAccount: { include: { competitionEntry: true } } },
        where: {
          id: command.orderId,
          tradingAccountId: command.tradingAccountId,
        },
      });
      if (order === null) {
        throw new SimulatorCommandError('Order was not found');
      }
      if (order.status === 'ACCEPTED') {
        await cancelAcceptedOrder(transaction, {
          actorUserId: order.tradingAccount.competitionEntry.userId,
          cancelledAt,
          orderId: order.id,
          reason: 'Cancelled by trader',
        });
        if (order.protectedPositionId !== null) {
          await transaction.position.update({
            data:
              order.type === 'STOP_LOSS'
                ? { stopLossPrice: null }
                : { takeProfitPrice: null },
            where: { id: order.protectedPositionId },
          });
        }
        return { orderId: order.id, status: 'CANCELLED' };
      }
      if (
        order.status === 'FILLED' ||
        order.status === 'EXPIRED' ||
        order.status === 'REJECTED' ||
        order.status === 'CANCELLED'
      ) {
        return {
          orderId: order.id,
          status: order.status === 'CANCELLED' ? 'CANCELLED' : order.status,
        };
      }
      throw new SimulatorCommandError(
        `Order cannot be cancelled from ${order.status}`,
      );
    });
  }

  async setPositionProtection(
    command: SetPositionProtectionCommand,
  ): Promise<SetPositionProtectionResult> {
    const submittedAt = command.submittedAt ?? new Date();
    return database.$transaction(async (transaction) => {
      await lockAccount(transaction, command.tradingAccountId);
      const position = await transaction.position.findFirst({
        include: {
          instrumentConfiguration: true,
          protectionOrders: { where: { status: 'ACCEPTED' } },
          tradingAccount: {
            include: { competitionEntry: { include: { competition: true } } },
          },
        },
        where: {
          id: command.positionId,
          status: 'OPEN',
          tradingAccountId: command.tradingAccountId,
        },
      });
      if (position === null) {
        throw new SimulatorCommandError('Open position was not found');
      }
      const account = position.tradingAccount;
      const competition = account.competitionEntry.competition;
      if (
        account.status !== 'ACTIVE' ||
        account.competitionEntry.status !== 'ACTIVE' ||
        competition.status !== 'ACTIVE' ||
        submittedAt < competition.tradingStartsAt ||
        submittedAt >= competition.tradingEndsAt
      ) {
        throw new SimulatorCommandError('Trading account is not active');
      }
      const instrument = toInstrument(position.instrumentConfiguration);
      if (!isMarketOpen(submittedAt, instrument.marketHoursMode)) {
        throw new SimulatorCommandError('Instrument market is closed');
      }
      const quote = await this.#provider.getLatestQuote(position.symbol);
      assertValidQuote(quote);
      if (!quoteIsFresh(quote, submittedAt, this.#maxQuoteAgeMs)) {
        throw new SimulatorCommandError('Market quote is stale');
      }
      for (const [type, price] of [
        ['STOP_LOSS', command.stopLossPrice] as const,
        ['TAKE_PROFIT', command.takeProfitPrice] as const,
      ]) {
        if (price !== undefined && price !== null) {
          assertValidOrderPrice(price, instrument);
          assertProtectionPricePlacement({
            positionSide: position.side,
            price,
            quote,
            type,
          });
        }
      }

      const requestedProtection = [
        ['STOP_LOSS', command.stopLossPrice] as const,
        ['TAKE_PROFIT', command.takeProfitPrice] as const,
      ].filter((entry): entry is [ProtectionOrderType, Decimal] => {
        return entry[1] !== undefined && entry[1] !== null;
      });
      const requestedClientOrderIds = requestedProtection.map(
        ([type]) => `${command.clientRequestId}:${type}`,
      );
      const requestOrders =
        requestedClientOrderIds.length === 0
          ? []
          : await transaction.order.findMany({
              where: {
                clientOrderId: { in: requestedClientOrderIds },
                tradingAccountId: account.id,
              },
            });
      if (requestOrders.length > 0) {
        const requestIsIdentical =
          requestOrders.length === requestedProtection.length &&
          requestedProtection.every(([type, price]) => {
            const existing = requestOrders.find(
              (candidate) => candidate.type === type,
            );
            return (
              existing !== undefined &&
              existing.status === 'ACCEPTED' &&
              existing.protectedPositionId === position.id &&
              existing.requestedPrice !== null &&
              new Decimal(existing.requestedPrice.toString()).equals(price)
            );
          });
        if (!requestIsIdentical) {
          throw new PendingOrderConflictError();
        }
        return {
          ...(requestOrders.find((order) => order.type === 'STOP_LOSS') ===
          undefined
            ? {}
            : {
                stopLossOrderId: requestOrders.find(
                  (order) => order.type === 'STOP_LOSS',
                )!.id,
              }),
          ...(requestOrders.find((order) => order.type === 'TAKE_PROFIT') ===
          undefined
            ? {}
            : {
                takeProfitOrderId: requestOrders.find(
                  (order) => order.type === 'TAKE_PROFIT',
                )!.id,
              }),
          ocoGroupId: requestOrders[0]!.ocoGroupId!,
          positionId: position.id,
        };
      }

      for (const order of position.protectionOrders) {
        await cancelAcceptedOrder(transaction, {
          actorUserId: account.competitionEntry.userId,
          cancelledAt: submittedAt,
          orderId: order.id,
          reason: 'Position protection replaced',
        });
      }
      const ocoGroupId = `protection:${eventDigest(
        `${position.id}:${command.clientRequestId}`,
      )}`;
      const created: Partial<Record<ProtectionOrderType, { id: string }>> = {};
      for (const [type, price] of [
        ['STOP_LOSS', command.stopLossPrice] as const,
        ['TAKE_PROFIT', command.takeProfitPrice] as const,
      ]) {
        if (price === undefined || price === null) {
          continue;
        }
        const clientOrderId = `${command.clientRequestId}:${type}`;
        const existing = await transaction.order.findUnique({
          where: {
            tradingAccountId_clientOrderId: {
              clientOrderId,
              tradingAccountId: account.id,
            },
          },
        });
        if (existing !== null) {
          if (
            existing.protectedPositionId !== position.id ||
            existing.type !== type ||
            !new Decimal(existing.requestedPrice!.toString()).equals(price)
          ) {
            throw new PendingOrderConflictError();
          }
          created[type] = existing;
          continue;
        }
        const order = await transaction.order.create({
          data: {
            clientOrderId,
            instrumentVersion: position.instrumentVersion,
            ocoGroupId,
            protectedPositionId: position.id,
            quantity: position.quantity,
            requestedPrice: price.toString(),
            side: protectionOrderSide(position.side),
            status: 'PENDING',
            ...(type === 'STOP_LOSS'
              ? { stopLossPrice: price.toString() }
              : { takeProfitPrice: price.toString() }),
            submittedAt,
            symbol: position.symbol,
            tradingAccountId: account.id,
            type,
          },
        });
        created[type] = order;
        await upsertAudit(transaction, {
          action: `${type}_ORDER_SUBMITTED`,
          actorUserId: account.competitionEntry.userId,
          after: {
            ocoGroupId,
            positionId: position.id,
            price: price.toString(),
            quantity: position.quantity.toString(),
            status: 'PENDING',
          },
          entityId: order.id,
          entityType: 'Order',
          idempotencyKey: `audit:order-submitted:${order.id}`,
        });
        assertStateTransition('Order', orderTransitions, 'PENDING', 'ACCEPTED');
        await transaction.order.update({
          data: { acceptedAt: submittedAt, status: 'ACCEPTED' },
          where: { id: order.id },
        });
        await upsertAudit(transaction, {
          action: `${type}_ORDER_ACCEPTED`,
          actorUserId: account.competitionEntry.userId,
          after: {
            ocoGroupId,
            positionId: position.id,
            price: price.toString(),
            quantity: position.quantity.toString(),
            status: 'ACCEPTED',
          },
          entityId: order.id,
          entityType: 'Order',
          idempotencyKey: `audit:order-accepted:${order.id}`,
        });
      }
      await transaction.position.update({
        data: {
          stopLossPrice: command.stopLossPrice?.toString() ?? null,
          takeProfitPrice: command.takeProfitPrice?.toString() ?? null,
        },
        where: { id: position.id },
      });
      await upsertAudit(transaction, {
        action: 'POSITION_PROTECTION_SET',
        actorUserId: account.competitionEntry.userId,
        after: {
          ocoGroupId,
          stopLossPrice: command.stopLossPrice?.toString() ?? null,
          takeProfitPrice: command.takeProfitPrice?.toString() ?? null,
        },
        entityId: position.id,
        entityType: 'Position',
        idempotencyKey: `audit:position-protection:${position.id}:${eventDigest(command.clientRequestId)}`,
      });
      return {
        ...(created.STOP_LOSS === undefined
          ? {}
          : { stopLossOrderId: created.STOP_LOSS.id }),
        ...(created.TAKE_PROFIT === undefined
          ? {}
          : { takeProfitOrderId: created.TAKE_PROFIT.id }),
        ...(Object.keys(created).length === 0 ? {} : { ocoGroupId }),
        positionId: position.id,
      };
    });
  }

  async #fillTriggeredOrder(
    transaction: Prisma.TransactionClient,
    orderId: string,
    quote: Quote,
  ): Promise<'CANCELLED' | 'EXPIRED' | 'FILLED'> {
    const order = await transaction.order.findUniqueOrThrow({
      include: {
        instrumentConfiguration: true,
        tradingAccount: {
          include: {
            competitionEntry: {
              include: { competition: true, tier: true },
            },
            positions: {
              include: { instrumentConfiguration: true },
              where: { status: 'OPEN' },
            },
          },
        },
      },
      where: { id: orderId },
    });
    if (order.status !== 'ACCEPTED') {
      if (order.status === 'FILLED') {
        return 'FILLED';
      }
      return order.status === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED';
    }
    const account = order.tradingAccount;
    const competition = account.competitionEntry.competition;
    if (
      account.status !== 'ACTIVE' ||
      account.competitionEntry.status !== 'ACTIVE'
    ) {
      await expireAcceptedOrder(transaction, {
        actorUserId: account.competitionEntry.userId,
        completedAt: quote.timestamp,
        orderId: order.id,
        reason: 'Trading account is not active',
      });
      return 'EXPIRED';
    }
    if (
      competition.status !== 'ACTIVE' ||
      quote.timestamp < competition.tradingStartsAt ||
      quote.timestamp >= competition.tradingEndsAt
    ) {
      await expireAcceptedOrder(transaction, {
        actorUserId: account.competitionEntry.userId,
        completedAt: quote.timestamp,
        orderId: order.id,
        reason: 'Competition trading window ended',
      });
      return 'EXPIRED';
    }

    const instrument = toInstrument(order.instrumentConfiguration);
    const currentPosition = account.positions.find(
      (position) => position.symbol === order.symbol,
    );
    const protectedPosition =
      order.protectedPositionId === null
        ? null
        : account.positions.find(
            (position) => position.id === order.protectedPositionId,
          );
    if (order.protectedPositionId !== null && protectedPosition === undefined) {
      await expireAcceptedOrder(transaction, {
        actorUserId: account.competitionEntry.userId,
        completedAt: quote.timestamp,
        orderId: order.id,
        reason: 'Protected position is no longer open',
      });
      if (order.ocoGroupId !== null) {
        const siblings = await transaction.order.findMany({
          where: {
            id: { not: order.id },
            ocoGroupId: order.ocoGroupId,
            status: 'ACCEPTED',
          },
        });
        for (const sibling of siblings) {
          await cancelAcceptedOrder(transaction, {
            actorUserId: account.competitionEntry.userId,
            cancelledAt: quote.timestamp,
            orderId: sibling.id,
            reason: 'Protected position is no longer open',
          });
        }
      }
      return 'EXPIRED';
    }
    const fillQuantity =
      protectedPosition === null
        ? new Decimal(order.quantity.toString())
        : new Decimal(protectedPosition!.quantity.toString());
    const quotes = await loadPositionQuotes(
      this.#provider,
      account.positions,
      quote,
      quote.timestamp,
      this.#maxQuoteAgeMs,
    );
    const fillPrice = marketFillPrice(order.side, quote);
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
      order.side,
      fillQuantity,
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
        quote,
      });
    }
    const projectedMetrics = calculateAccountMetrics(
      projectedBalance,
      projectedPositions,
    );
    if (projectedMetrics.marginFreeMinor < 0n) {
      await expireAcceptedOrder(transaction, {
        actorUserId: account.competitionEntry.userId,
        completedAt: quote.timestamp,
        orderId: order.id,
        reason: 'Insufficient free margin at trigger',
      });
      return 'EXPIRED';
    }

    const engineEventId = `trigger:${order.id}:${quote.sequence}`;
    const execution = await transaction.execution.create({
      data: {
        commission: 0,
        engineEventId,
        executedAt: quote.timestamp,
        instrumentVersion: order.instrumentVersion,
        notional: calculateNotional(
          fillQuantity,
          fillPrice,
          instrument,
        ).toString(),
        orderId: order.id,
        price: fillPrice.toString(),
        quantity: fillQuantity.toString(),
        side: order.side,
        symbol: order.symbol,
        tradingAccountId: account.id,
      },
    });

    let affectedPositionId = currentPosition?.id ?? execution.id;
    if (currentPosition === undefined && mutation.nextPosition !== null) {
      const createdPosition = await transaction.position.create({
        data: {
          averageEntryPrice: mutation.nextPosition.averageEntryPrice.toString(),
          instrumentVersion: order.instrumentVersion,
          openedAt: quote.timestamp,
          openingExecutionId: execution.id,
          quantity: mutation.nextPosition.quantity.toString(),
          side: mutation.nextPosition.side,
          status: 'OPEN',
          symbol: order.symbol,
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
      if (mutation.closedQuantity.greaterThan(0)) {
        if (currentPosition.openingExecutionId === null) {
          throw new SimulatorCommandError(
            'Position has no opening execution reference',
          );
        }
        await transaction.closedTrade.create({
          data: {
            closedAt: quote.timestamp,
            closingExecutionId: execution.id,
            commission: 0,
            entryPrice: currentPosition.averageEntryPrice,
            exitPrice: fillPrice.toString(),
            instrumentVersion: order.instrumentVersion,
            openedAt: currentPosition.openedAt,
            openingExecutionId: currentPosition.openingExecutionId,
            positionId: currentPosition.id,
            quantity: mutation.closedQuantity.toString(),
            realizedPnl: rawRealized.toString(),
            side: currentPosition.side,
            symbol: order.symbol,
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
            closedAt: quote.timestamp,
            quantity: 0,
            realizedPnl: new Decimal(currentPosition.realizedPnl.toString())
              .plus(rawRealized)
              .toString(),
            status: 'CLOSED',
            stopLossPrice: null,
            takeProfitPrice: null,
          },
          where: { id: currentPosition.id },
        });
        if (mutation.kind === 'REVERSE' && mutation.nextPosition !== null) {
          const reversedPosition = await transaction.position.create({
            data: {
              averageEntryPrice:
                mutation.nextPosition.averageEntryPrice.toString(),
              instrumentVersion: order.instrumentVersion,
              openedAt: quote.timestamp,
              openingExecutionId: execution.id,
              quantity: mutation.nextPosition.quantity.toString(),
              side: mutation.nextPosition.side,
              status: 'OPEN',
              symbol: order.symbol,
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

      if (mutation.kind === 'CLOSE' || mutation.kind === 'REVERSE') {
        const staleProtection = await transaction.order.findMany({
          where: {
            id: { not: order.id },
            protectedPositionId: currentPosition.id,
            status: 'ACCEPTED',
          },
        });
        for (const protection of staleProtection) {
          await cancelAcceptedOrder(transaction, {
            actorUserId: account.competitionEntry.userId,
            cancelledAt: quote.timestamp,
            orderId: protection.id,
            reason: 'Protected position closed',
          });
        }
      } else if (mutation.nextPosition !== null) {
        await transaction.order.updateMany({
          data: { quantity: mutation.nextPosition.quantity.toString() },
          where: {
            protectedPositionId: currentPosition.id,
            status: 'ACCEPTED',
          },
        });
      }
    }

    if (mutation.closedQuantity.greaterThan(0)) {
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
          occurredAt: quote.timestamp,
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
        completedAt: quote.timestamp,
        filledQuantity: fillQuantity.toString(),
        status: 'FILLED',
        terminalReason: 'Triggered by normalized quote',
        triggeredAt: quote.timestamp,
        triggerQuoteSequence: quote.sequence,
      },
      where: { id: order.id },
    });
    await Promise.all([
      upsertAudit(transaction, {
        action: `${order.type}_ORDER_FILLED`,
        actorUserId: account.competitionEntry.userId,
        after: {
          executionId: execution.id,
          fillPrice: fillPrice.toString(),
          quoteSequence: quote.sequence.toString(),
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
          remainingQuantity: mutation.nextPosition?.quantity.toString() ?? '0',
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
      asOf: quote.timestamp,
      balanceMinor: projectedBalance,
      maxDrawdownLimitMinor: account.competitionEntry.tier.maxDrawdownMinor,
      metrics: projectedMetrics,
      sourceEventId: `execution:${execution.id}`,
    });
    return 'FILLED';
  }

  async processPendingOrders(quote: Quote): Promise<{
    cancelledProtectionOrders: number;
    expiredOrders: number;
    filledOrders: number;
  }> {
    assertValidQuote(quote);
    const normalizedQuote = {
      ...quote,
      symbol: normalizeSymbol(quote.symbol),
    };
    const orderRefs = await database.order.findMany({
      orderBy: [
        { tradingAccountId: 'asc' },
        { acceptedAt: 'asc' },
        { id: 'asc' },
      ],
      select: { id: true, tradingAccountId: true },
      where: {
        status: 'ACCEPTED',
        symbol: normalizedQuote.symbol,
        type: { in: ['LIMIT', 'STOP', 'STOP_LOSS', 'TAKE_PROFIT'] },
      },
    });
    const result = {
      cancelledProtectionOrders: 0,
      expiredOrders: 0,
      filledOrders: 0,
    };
    for (const orderRef of orderRefs) {
      const outcome = await database.$transaction(async (transaction) => {
        await lockAccount(transaction, orderRef.tradingAccountId);
        const order = await transaction.order.findUnique({
          include: {
            instrumentConfiguration: true,
            protectedPosition: true,
            tradingAccount: {
              include: {
                competitionEntry: { include: { competition: true } },
              },
            },
          },
          where: { id: orderRef.id },
        });
        if (order === null || order.status !== 'ACCEPTED') {
          return null;
        }
        if (
          order.acceptedAt !== null &&
          normalizedQuote.timestamp < order.acceptedAt
        ) {
          return null;
        }
        const competition = order.tradingAccount.competitionEntry.competition;
        if (
          competition.status !== 'ACTIVE' ||
          normalizedQuote.timestamp >= competition.tradingEndsAt
        ) {
          await expireAcceptedOrder(transaction, {
            actorUserId: order.tradingAccount.competitionEntry.userId,
            completedAt: normalizedQuote.timestamp,
            orderId: order.id,
            reason: 'Competition trading window ended',
          });
          return 'EXPIRED' as const;
        }
        const instrument = toInstrument(order.instrumentConfiguration);
        if (
          !isMarketOpen(normalizedQuote.timestamp, instrument.marketHoursMode)
        ) {
          return null;
        }
        let triggered: boolean;
        if (order.type === 'LIMIT' || order.type === 'STOP') {
          const triggerPrice =
            order.type === 'LIMIT' ? order.limitPrice : order.stopPrice;
          if (triggerPrice === null) {
            await expireAcceptedOrder(transaction, {
              actorUserId: order.tradingAccount.competitionEntry.userId,
              completedAt: normalizedQuote.timestamp,
              orderId: order.id,
              reason: 'Order trigger price is missing',
            });
            return 'EXPIRED' as const;
          }
          triggered = shouldTriggerPendingOrder({
            quote: normalizedQuote,
            side: order.side,
            triggerPrice: new Decimal(triggerPrice.toString()),
            type: order.type,
          });
        } else {
          const triggerPrice =
            order.type === 'STOP_LOSS'
              ? order.stopLossPrice
              : order.takeProfitPrice;
          if (
            triggerPrice === null ||
            order.protectedPosition === null ||
            order.protectedPosition.status !== 'OPEN'
          ) {
            return this.#fillTriggeredOrder(
              transaction,
              order.id,
              normalizedQuote,
            );
          }
          triggered = shouldTriggerProtectionOrder({
            positionSide: order.protectedPosition.side,
            price: new Decimal(triggerPrice.toString()),
            quote: normalizedQuote,
            type: order.type as ProtectionOrderType,
          });
        }
        if (!triggered) {
          return null;
        }
        return this.#fillTriggeredOrder(transaction, order.id, normalizedQuote);
      });
      if (outcome === 'FILLED') {
        result.filledOrders += 1;
      } else if (outcome === 'EXPIRED') {
        result.expiredOrders += 1;
      } else if (outcome === 'CANCELLED') {
        result.cancelledProtectionOrders += 1;
      }
    }
    return result;
  }

  async processQuote(quote: Quote): Promise<ProcessQuoteResult> {
    const orders = await this.processPendingOrders(quote);
    const risk = await this.markToMarket(quote);
    return { ...orders, ...risk };
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
      orders: {
        orderBy: [{ acceptedAt: 'asc' }, { id: 'asc' }],
        where: {
          status: 'ACCEPTED',
          type: { in: ['LIMIT', 'STOP', 'STOP_LOSS', 'TAKE_PROFIT'] },
        },
      },
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
      activeOrders: account.orders.map((order) => {
        const price =
          order.type === 'LIMIT'
            ? order.limitPrice
            : order.type === 'STOP'
              ? order.stopPrice
              : order.type === 'STOP_LOSS'
                ? order.stopLossPrice
                : order.takeProfitPrice;
        if (order.acceptedAt === null || price === null) {
          throw new SimulatorCommandError(
            `Accepted order ${order.id} is missing recovery metadata`,
          );
        }
        return {
          acceptedAt: order.acceptedAt,
          id: order.id,
          price: price.toString(),
          protectedPositionId: order.protectedPositionId,
          quantity: order.quantity.toString(),
          side: order.side,
          symbol: order.symbol,
          type: order.type as 'LIMIT' | 'STOP' | 'STOP_LOSS' | 'TAKE_PROFIT',
        };
      }),
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
