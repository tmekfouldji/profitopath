import 'server-only';

import { database } from '@profitopath/database';
import Decimal from 'decimal.js';

import { getTerminalQuoteStore } from './terminal';
import { calculateLivePositionMetrics } from './terminal-position-metrics';

function stringOrNull(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null;
}

export async function getOwnedTerminalState(accountId: string, userId: string) {
  const [account, instruments] = await Promise.all([
    database.tradingAccount.findFirst({
      include: {
        closedTrades: { orderBy: { closedAt: 'desc' }, take: 100 },
        competitionEntry: {
          include: { competition: true, tier: true },
        },
        executions: { orderBy: { executedAt: 'desc' }, take: 100 },
        orders: {
          include: { executions: true },
          orderBy: { submittedAt: 'desc' },
          take: 100,
        },
        positions: {
          include: { instrumentConfiguration: true },
          orderBy: { openedAt: 'desc' },
          where: { status: 'OPEN' },
        },
        snapshots: { orderBy: { sequence: 'desc' }, take: 1 },
      },
      where: { competitionEntry: { userId }, id: accountId },
    }),
    database.instrumentConfiguration.findMany({
      orderBy: { symbol: 'asc' },
      where: { active: true },
    }),
  ]);
  if (account === null) {
    return null;
  }
  const quotes = await Promise.all(
    instruments.map(async (instrument) => {
      try {
        const quote = await getTerminalQuoteStore().get(instrument.symbol);
        return {
          ask: quote?.ask.toString() ?? null,
          bid: quote?.bid.toString() ?? null,
          sequence: quote?.sequence.toString() ?? null,
          status: quote === null ? ('MISSING' as const) : ('LIVE' as const),
          symbol: instrument.symbol,
          timestamp: quote?.timestamp.toISOString() ?? null,
        };
      } catch {
        return {
          ask: null,
          bid: null,
          sequence: null,
          status: 'MISSING' as const,
          symbol: instrument.symbol,
          timestamp: null,
        };
      }
    }),
  );
  const snapshot = account.snapshots[0];
  const equityMinor = snapshot?.equityMinor ?? account.balanceMinor;
  const currentDrawdownMinor =
    equityMinor < account.startingBalanceMinor
      ? account.startingBalanceMinor - equityMinor
      : 0n;
  const drawdownRemainingMinor =
    account.competitionEntry.tier.maxDrawdownMinor > currentDrawdownMinor
      ? account.competitionEntry.tier.maxDrawdownMinor - currentDrawdownMinor
      : 0n;
  const liveQuotes = new Map(
    quotes.flatMap((quote) => {
      if (
        quote.status === 'MISSING' ||
        quote.ask === null ||
        quote.bid === null
      ) {
        return [];
      }
      return [
        [
          quote.symbol,
          {
            ask: new Decimal(quote.ask),
            bid: new Decimal(quote.bid),
          },
        ] as const,
      ];
    }),
  );
  return {
    account: {
      balanceMinor: account.balanceMinor.toString(),
      breachedAt: account.breachedAt?.toISOString() ?? null,
      competition: {
        code: account.competitionEntry.competition.code,
        name: account.competitionEntry.competition.name,
        tradingEndsAt:
          account.competitionEntry.competition.tradingEndsAt.toISOString(),
        tradingStartsAt:
          account.competitionEntry.competition.tradingStartsAt.toISOString(),
      },
      configVersion: account.configVersion,
      id: account.id,
      realizedPnlMinor: account.realizedPnlMinor.toString(),
      startingBalanceMinor: account.startingBalanceMinor.toString(),
      status: account.status,
      tier: {
        code: account.competitionEntry.tier.code,
        maxDrawdownMinor:
          account.competitionEntry.tier.maxDrawdownMinor.toString(),
        name: account.competitionEntry.tier.name,
      },
    },
    closedTrades: account.closedTrades.map((trade) => ({
      closedAt: trade.closedAt.toISOString(),
      entryPrice: trade.entryPrice.toString(),
      exitPrice: trade.exitPrice.toString(),
      id: trade.id,
      openedAt: trade.openedAt.toISOString(),
      quantity: trade.quantity.toString(),
      realizedPnl: trade.realizedPnl.toString(),
      side: trade.side,
      symbol: trade.symbol,
    })),
    executions: account.executions.map((execution) => ({
      executedAt: execution.executedAt.toISOString(),
      id: execution.id,
      orderId: execution.orderId,
      price: execution.price.toString(),
      quantity: execution.quantity.toString(),
      side: execution.side,
      symbol: execution.symbol,
    })),
    instruments: instruments.map((instrument) => ({
      minimumQuantity: instrument.minimumQuantity.toString(),
      priceScale: instrument.priceScale,
      quantityStep: instrument.quantityStep.toString(),
      symbol: instrument.symbol,
    })),
    metrics: {
      asOf: snapshot?.asOf.toISOString() ?? null,
      currentDrawdownMinor: currentDrawdownMinor.toString(),
      drawdownRemainingMinor: drawdownRemainingMinor.toString(),
      equityMinor: equityMinor.toString(),
      marginFreeMinor:
        snapshot?.marginFreeMinor.toString() ?? account.balanceMinor.toString(),
      marginUsedMinor: snapshot?.marginUsedMinor.toString() ?? '0',
      maxDrawdownMinor: snapshot?.maxDrawdownMinor.toString() ?? '0',
      unrealizedPnlMinor: snapshot?.unrealizedPnlMinor.toString() ?? '0',
    },
    orders: account.orders.map((order) => ({
      averageFillPrice: stringOrNull(order.averageFillPrice),
      clientOrderId: order.clientOrderId,
      completedAt: order.completedAt?.toISOString() ?? null,
      filledQuantity: order.filledQuantity.toString(),
      id: order.id,
      limitPrice: stringOrNull(order.limitPrice),
      protectedPositionId: order.protectedPositionId,
      quantity: order.quantity.toString(),
      rejectionReason: order.rejectionReason,
      side: order.side,
      status: order.status,
      stopLossPrice: stringOrNull(order.stopLossPrice),
      stopPrice: stringOrNull(order.stopPrice),
      submittedAt: order.submittedAt.toISOString(),
      symbol: order.symbol,
      takeProfitPrice: stringOrNull(order.takeProfitPrice),
      terminalReason: order.terminalReason,
      type: order.type,
    })),
    positions: account.positions.map((position) => {
      const quote = liveQuotes.get(position.symbol);
      const liveMetrics = calculateLivePositionMetrics({
        ask: quote?.ask ?? null,
        averageEntryPrice: new Decimal(position.averageEntryPrice.toString()),
        bid: quote?.bid ?? null,
        contractSize: new Decimal(
          position.instrumentConfiguration.contractSize.toString(),
        ),
        priceScale: position.instrumentConfiguration.priceScale,
        quantity: new Decimal(position.quantity.toString()),
        side: position.side,
      });
      return {
        averageEntryPrice: position.averageEntryPrice.toString(),
        id: position.id,
        markPrice: liveMetrics?.markPrice ?? null,
        openedAt: position.openedAt.toISOString(),
        priceScale: position.instrumentConfiguration.priceScale,
        quantity: position.quantity.toString(),
        realizedPnl: position.realizedPnl.toString(),
        side: position.side,
        stopLossPrice: stringOrNull(position.stopLossPrice),
        symbol: position.symbol,
        takeProfitPrice: stringOrNull(position.takeProfitPrice),
        unrealizedPips: liveMetrics?.unrealizedPips ?? null,
        unrealizedPnlMinor: liveMetrics?.unrealizedPnlMinor ?? null,
      };
    }),
    quotes,
    version: snapshot?.sequence.toString() ?? '0',
  };
}

export type OwnedTerminalState = NonNullable<
  Awaited<ReturnType<typeof getOwnedTerminalState>>
>;
