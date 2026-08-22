import { database } from '@profitopath/database';
import {
  InvalidCandleRangeError,
  type CandleTimeframe,
} from '@profitopath/market-data';
import { NextResponse } from 'next/server';

import { getSession } from '@/server/auth/session';
import { terminalCandleService } from '@/server/terminal';

const timeframes = new Set<CandleTimeframe>([
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (session?.user === undefined || session.user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const query = new URL(request.url).searchParams;
  const accountId = query.get('accountId') ?? '';
  const symbol = (query.get('symbol') ?? '').toUpperCase();
  const timeframe = query.get('timeframe') ?? '';
  const from = new Date(query.get('from') ?? '');
  const to = new Date(query.get('to') ?? '');
  const limit = Number(query.get('limit') ?? '500');
  if (!timeframes.has(timeframe as CandleTimeframe)) {
    return NextResponse.json(
      { error: 'unsupported_timeframe' },
      { status: 400 },
    );
  }
  const [account, instrument] = await Promise.all([
    database.tradingAccount.findFirst({
      select: { id: true },
      where: {
        competitionEntry: { userId: session.user.id },
        id: accountId,
      },
    }),
    database.instrumentConfiguration.findFirst({
      select: { symbol: true },
      where: { active: true, symbol },
    }),
  ]);
  if (account === null || instrument === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const candles = await terminalCandleService.getCandles({
      from,
      limit,
      symbol,
      timeframe: timeframe as CandleTimeframe,
      to,
    });
    return NextResponse.json({
      candles: candles.map((candle) => ({
        close: candle.close.toString(),
        closeTime: candle.closeTime.toISOString(),
        high: candle.high.toString(),
        isFinal: candle.isFinal,
        low: candle.low.toString(),
        open: candle.open.toString(),
        openTime: candle.openTime.toISOString(),
        source: candle.source,
      })),
      complete: candles.length > 0,
      from: from.toISOString(),
      symbol,
      timeframe,
      to: to.toISOString(),
    });
  } catch (error) {
    if (error instanceof InvalidCandleRangeError) {
      return NextResponse.json(
        { error: 'invalid_range', message: error.message },
        { status: 400 },
      );
    }
    throw error;
  }
}
