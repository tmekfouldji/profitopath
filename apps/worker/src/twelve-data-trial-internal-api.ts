import { timingSafeEqual } from 'node:crypto';

import { normalizeSymbol } from '@profitopath/market-data';

const minuteMs = 60_000;
const staffSymbols = new Set(['EURUSD', 'GBPUSD']);

export interface TrialBackfillRequest {
  from: Date;
  symbol: 'EURUSD' | 'GBPUSD';
  to: Date;
}

export class TwelveDataTrialInternalApiError extends Error {
  constructor(message: string) {
    super(`Twelve Data internal API request rejected: ${message}`);
    this.name = 'TwelveDataTrialInternalApiError';
  }
}

export function hasInternalMarketDataAuthorization(
  authorization: string | undefined,
  token: string,
): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(authorization ?? '');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function parseTrialBackfillRequest(
  value: unknown,
  maximumMinutes: number,
): TrialBackfillRequest {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('from' in value) ||
    !('symbol' in value) ||
    !('to' in value)
  ) {
    throw new TwelveDataTrialInternalApiError('body is malformed');
  }
  const from = new Date(String(value.from));
  const to = new Date(String(value.to));
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to ||
    from.getTime() % minuteMs !== 0 ||
    to.getTime() % minuteMs !== 0
  ) {
    throw new TwelveDataTrialInternalApiError(
      'range must use increasing UTC-minute timestamps',
    );
  }
  const minutes = (to.getTime() - from.getTime()) / minuteMs;
  if (minutes > maximumMinutes) {
    throw new TwelveDataTrialInternalApiError(
      `range exceeds the ${maximumMinutes}-minute trial limit`,
    );
  }
  const symbol = normalizeSymbol(String(value.symbol));
  if (!staffSymbols.has(symbol)) {
    throw new TwelveDataTrialInternalApiError(
      'symbol is not enabled for the trial',
    );
  }
  return { from, symbol: symbol as TrialBackfillRequest['symbol'], to };
}
