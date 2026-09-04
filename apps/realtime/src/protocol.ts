export interface RealtimeQuoteDelta {
  ask: string;
  bid: string;
  kind: 'quote';
  sequence: string;
  symbol: string;
  timestamp: string;
}

export interface RealtimeCandleDelta {
  close: string;
  closeTime: string;
  high: string;
  isFinal: boolean;
  kind: 'candle';
  low: string;
  open: string;
  openTime: string;
  source: string;
  symbol: string;
  timeframe: string;
}

export interface RealtimeAccountStateDelta {
  kind: 'account-state';
  sequence: string;
  symbol: string;
  timestamp: string;
}

export function parseQuoteDelta(message: string): RealtimeQuoteDelta | null {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('ask' in value) ||
    !('bid' in value) ||
    !('sequence' in value) ||
    !('symbol' in value) ||
    !('timestamp' in value)
  ) {
    return null;
  }
  const timestamp = new Date(String(value.timestamp));
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return {
    ask: String(value.ask),
    bid: String(value.bid),
    kind: 'quote',
    sequence: String(value.sequence),
    symbol: String(value.symbol).toUpperCase(),
    timestamp: timestamp.toISOString(),
  };
}

export function parseCandleDelta(message: string): RealtimeCandleDelta | null {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('close' in value) ||
    !('closeTime' in value) ||
    !('high' in value) ||
    !('isFinal' in value) ||
    !('low' in value) ||
    !('open' in value) ||
    !('openTime' in value) ||
    !('source' in value) ||
    !('symbol' in value) ||
    !('timeframe' in value)
  ) {
    return null;
  }
  const openTime = new Date(String(value.openTime));
  const closeTime = new Date(String(value.closeTime));
  if (Number.isNaN(openTime.getTime()) || Number.isNaN(closeTime.getTime())) {
    return null;
  }
  return {
    close: String(value.close),
    closeTime: closeTime.toISOString(),
    high: String(value.high),
    isFinal: Boolean(value.isFinal),
    kind: 'candle',
    low: String(value.low),
    open: String(value.open),
    openTime: openTime.toISOString(),
    source: String(value.source),
    symbol: String(value.symbol).toUpperCase(),
    timeframe: String(value.timeframe),
  };
}

export function parseAccountStateDelta(
  message: string,
): RealtimeAccountStateDelta | null {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return null;
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    value.kind !== 'account-state' ||
    !('sequence' in value) ||
    !('symbol' in value) ||
    !('timestamp' in value)
  ) {
    return null;
  }
  const timestamp = new Date(String(value.timestamp));
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return {
    kind: 'account-state',
    sequence: String(value.sequence),
    symbol: String(value.symbol).toUpperCase(),
    timestamp: timestamp.toISOString(),
  };
}
