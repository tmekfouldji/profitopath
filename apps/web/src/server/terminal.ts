import 'server-only';

import { database } from '@profitopath/database';
import {
  CachedMarketDataProvider,
  MarketCandleService,
  ValkeyQuoteStore,
} from '@profitopath/market-data';
import { createValkeyClient, parseRuntimeEnv } from '@profitopath/shared';
import {
  PersistentSimulatedExecutionEngine,
  type CancelOrderCommand,
  type SetPositionProtectionCommand,
  type SubmitMarketOrderCommand,
  type SubmitPendingOrderCommand,
} from '@profitopath/simulator';

import { WorkerBackfilledCandleService } from './twelve-data-trial-history';

const terminalLocalCandleService = new MarketCandleService(
  undefined,
  process.env.MARKET_DATA_SOURCE === 'twelve-data-trial'
    ? {
        baseSources: ['TWELVE_DATA_TRIAL'],
        derivedSources: ['DERIVED_TWELVE_DATA_TRIAL'],
      }
    : {},
);
export const terminalCandleService =
  process.env.MARKET_DATA_SOURCE === 'twelve-data-trial'
    ? new WorkerBackfilledCandleService(terminalLocalCandleService)
    : terminalLocalCandleService;
let quoteStore: ValkeyQuoteStore | undefined;
let executionEngine: PersistentSimulatedExecutionEngine | undefined;

export function getTerminalQuoteStore(): ValkeyQuoteStore {
  quoteStore ??= new ValkeyQuoteStore(
    createValkeyClient(parseRuntimeEnv().VALKEY_URL),
  );
  return quoteStore;
}

function getTerminalExecutionEngine(): PersistentSimulatedExecutionEngine {
  executionEngine ??= new PersistentSimulatedExecutionEngine(
    new CachedMarketDataProvider(
      getTerminalQuoteStore(),
      terminalLocalCandleService,
    ),
  );
  return executionEngine;
}

export class TerminalAccountAccessError extends Error {
  constructor() {
    super('Trading account was not found');
    this.name = 'TerminalAccountAccessError';
  }
}

export async function assertOwnedTradingAccount(
  tradingAccountId: string,
  userId: string,
): Promise<void> {
  const account = await database.tradingAccount.findFirst({
    select: { id: true },
    where: {
      competitionEntry: { userId },
      id: tradingAccountId,
    },
  });
  if (account === null) {
    throw new TerminalAccountAccessError();
  }
}

export async function submitOwnedMarketOrder(
  userId: string,
  command: SubmitMarketOrderCommand,
) {
  await assertOwnedTradingAccount(command.tradingAccountId, userId);
  return getTerminalExecutionEngine().submitMarketOrder(command);
}

export async function submitOwnedPendingOrder(
  userId: string,
  command: SubmitPendingOrderCommand,
) {
  await assertOwnedTradingAccount(command.tradingAccountId, userId);
  return getTerminalExecutionEngine().submitPendingOrder(command);
}

export async function cancelOwnedOrder(
  userId: string,
  command: CancelOrderCommand,
) {
  await assertOwnedTradingAccount(command.tradingAccountId, userId);
  return getTerminalExecutionEngine().cancelOrder(command);
}

export async function setOwnedPositionProtection(
  userId: string,
  command: SetPositionProtectionCommand,
) {
  await assertOwnedTradingAccount(command.tradingAccountId, userId);
  return getTerminalExecutionEngine().setPositionProtection(command);
}
