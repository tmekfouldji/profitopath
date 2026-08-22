import { database } from '@profitopath/database';
import { notFound } from 'next/navigation';

import type {
  TerminalChartCandle,
  TerminalChartMarker,
} from '@/components/terminal-chart';
import { TerminalWorkspace } from '@/components/terminal-workspace';
import { requireUser } from '@/server/auth/session';
import { terminalCandleService } from '@/server/terminal';
import { getOwnedTerminalState } from '@/server/terminal-read-model';

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const user = await requireUser(`/terminal/${accountId}`);
  const state = await getOwnedTerminalState(accountId, user.id);
  if (state === null) {
    notFound();
  }
  const initialSymbol =
    state.positions[0]?.symbol ?? state.instruments[0]?.symbol ?? 'EURUSD';
  const latest = await database.marketCandle.findFirst({
    orderBy: { openTime: 'desc' },
    where: { isFinal: true, symbol: initialSymbol, timeframe: '1m' },
  });
  const to =
    latest?.closeTime ?? new Date(state.account.competition.tradingStartsAt);
  const from = new Date(to.getTime() - 240 * 60_000);
  const candles = await terminalCandleService.getCandles({
    from,
    limit: 240,
    symbol: initialSymbol,
    timeframe: '1m',
    to,
  });
  const initialCandles: TerminalChartCandle[] = candles.map((candle) => ({
    close: candle.close.toString(),
    high: candle.high.toString(),
    isFinal: candle.isFinal,
    low: candle.low.toString(),
    open: candle.open.toString(),
    openTime: candle.openTime.toISOString(),
  }));
  const markers: TerminalChartMarker[] = state.executions.map((execution) => ({
    color: execution.side === 'BUY' ? '#56d6c9' : '#ff8065',
    position: execution.side === 'BUY' ? 'belowBar' : 'aboveBar',
    shape: execution.side === 'BUY' ? 'arrowUp' : 'arrowDown',
    text: `${execution.symbol} ${execution.side} ${execution.quantity}`,
    time: execution.executedAt,
  }));

  return (
    <TerminalWorkspace
      historyAnchor={to.toISOString()}
      initialCandles={initialCandles}
      initialSymbol={initialSymbol}
      initialState={state}
      markers={markers}
      realtimeUrl={
        process.env.NEXT_PUBLIC_REALTIME_URL ?? 'ws://localhost:3001'
      }
    />
  );
}
