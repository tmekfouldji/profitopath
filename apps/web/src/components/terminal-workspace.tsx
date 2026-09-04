'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Decimal from 'decimal.js';

import { initialTerminalActionState } from '@/app/terminal/[accountId]/action-state';
import {
  cancelTerminalOrder,
  updatePositionProtection,
} from '@/app/terminal/[accountId]/actions';
import type { OwnedTerminalState } from '@/server/terminal-read-model';

import {
  TerminalChart,
  type TerminalChartCandle,
  type TerminalOrderDraft,
} from './terminal-chart';
import { TerminalOrderTicket } from './terminal-order-ticket';

type ConnectionState = 'CONNECTING' | 'LIVE' | 'OFFLINE' | 'STALE';

function money(value: string): string {
  const units = BigInt(value);
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${whole}.${cents}`;
}

function signedMoney(value: string): string {
  const amount = BigInt(value);
  return `${amount > 0n ? '+' : ''}${money(value)}`;
}

function dateTime(value: string | null): string {
  if (value === null) {
    return '—';
  }
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function favoriteSymbolsStorageKey(accountId: string): string {
  return `profitopath:terminal-favorites:v1:${accountId}`;
}

function selectedSymbolStorageKey(accountId: string): string {
  return `profitopath:terminal-selected-symbol:v1:${accountId}`;
}

function defaultSelectedSymbol(state: OwnedTerminalState): string {
  return state.positions[0]?.symbol ?? state.instruments[0]?.symbol ?? 'EURUSD';
}

function liveSpreadPips(
  quote: OwnedTerminalState['quotes'][number] | undefined,
  priceScale: number | undefined,
): string {
  if (
    quote?.status !== 'LIVE' ||
    quote.ask === null ||
    quote.bid === null ||
    priceScale === undefined
  ) {
    return '—';
  }
  try {
    const pips = new Decimal(quote.ask)
      .minus(quote.bid)
      .times(new Decimal(10).pow(priceScale - 1));
    return `${pips.toFixed(pips.decimalPlaces() > 1 ? 2 : 1)} pips`;
  } catch {
    return '—';
  }
}

function defaultPendingOrderPrice(input: {
  ask: string;
  bid: string;
  priceScale: number;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'STOP';
}): string {
  const pip = new Decimal(10).pow(1 - input.priceScale);
  const offset = pip.times(10);
  const isAboveMarket =
    (input.side === 'BUY' && input.type === 'STOP') ||
    (input.side === 'SELL' && input.type === 'LIMIT');
  const reference =
    input.side === 'BUY' ? new Decimal(input.ask) : new Decimal(input.bid);
  return reference
    .plus(isAboveMarket ? offset : offset.negated())
    .toFixed(input.priceScale);
}

function TerminalInstrumentRail({
  accountId,
  instruments,
  quotes,
  selectedSymbol,
  setSelectedSymbol,
}: {
  accountId: string;
  instruments: OwnedTerminalState['instruments'];
  quotes: OwnedTerminalState['quotes'];
  selectedSymbol: string;
  setSelectedSymbol(symbol: string): void;
}) {
  const storageKey = favoriteSymbolsStorageKey(accountId);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        window.localStorage.getItem(storageKey) ?? '[]',
      );
      setFavorites(
        Array.isArray(stored)
          ? stored.filter(
              (symbol): symbol is string => typeof symbol === 'string',
            )
          : [],
      );
    } catch {
      setFavorites([]);
    }
  }, [storageKey]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const orderedInstruments = useMemo(
    () =>
      [...instruments].sort(
        (left, right) =>
          Number(favoriteSet.has(right.symbol)) -
            Number(favoriteSet.has(left.symbol)) ||
          left.symbol.localeCompare(right.symbol),
      ),
    [favoriteSet, instruments],
  );

  function toggleFavorite(symbol: string) {
    setFavorites((current) => {
      const next = current.includes(symbol)
        ? current.filter((candidate) => candidate !== symbol)
        : [...current, symbol];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Favorites are optional browser preference, never terminal authority.
      }
      return next;
    });
  }

  return (
    <aside
      aria-label="Instrument watchlist"
      className="terminal-instrument-rail"
    >
      <header>
        <span className="data-label">Instruments</span>
        <strong>{orderedInstruments.length}</strong>
      </header>
      <ul>
        {orderedInstruments.map((instrument) => {
          const quote = quotes.find(
            (candidate) => candidate.symbol === instrument.symbol,
          );
          const favorite = favoriteSet.has(instrument.symbol);
          return (
            <li
              className={
                instrument.symbol === selectedSymbol ? 'is-selected' : ''
              }
              key={instrument.symbol}
            >
              <button
                aria-pressed={instrument.symbol === selectedSymbol}
                className="terminal-instrument-select"
                onClick={() => setSelectedSymbol(instrument.symbol)}
                type="button"
              >
                <strong>{instrument.symbol}</strong>
                <span>
                  <b>{quote?.bid ?? '—'}</b>
                  <b>{quote?.ask ?? '—'}</b>
                </span>
                <small>{liveSpreadPips(quote, instrument.priceScale)}</small>
              </button>
              <button
                aria-label={`${favorite ? 'Remove' : 'Add'} ${instrument.symbol} ${
                  favorite ? 'from' : 'to'
                } favorites`}
                aria-pressed={favorite}
                className="terminal-favorite-toggle"
                onClick={() => toggleFavorite(instrument.symbol)}
                title={favorite ? 'Remove favorite' : 'Add favorite'}
                type="button"
              >
                ★
              </button>
            </li>
          );
        })}
      </ul>
      <p>Star instruments to keep them at the top on this device.</p>
    </aside>
  );
}

function ProtectionForm({
  accountId,
  position,
}: {
  accountId: string;
  position: OwnedTerminalState['positions'][number];
}) {
  const [state, action, pending] = useActionState(
    updatePositionProtection,
    initialTerminalActionState,
  );
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (state.status === 'SUCCESS') {
      setRequestId(crypto.randomUUID());
    }
  }, [state.status]);
  return (
    <form action={action} className="protection-form">
      <input name="accountId" type="hidden" value={accountId} />
      <input name="clientRequestId" type="hidden" value={requestId} />
      <input name="positionId" type="hidden" value={position.id} />
      <label>
        <span>SL</span>
        <input
          defaultValue={position.stopLossPrice ?? ''}
          inputMode="decimal"
          key={`${position.id}:sl:${position.stopLossPrice ?? 'none'}`}
          name="stopLossPrice"
          placeholder="None"
        />
      </label>
      <label>
        <span>TP</span>
        <input
          defaultValue={position.takeProfitPrice ?? ''}
          inputMode="decimal"
          key={`${position.id}:tp:${position.takeProfitPrice ?? 'none'}`}
          name="takeProfitPrice"
          placeholder="None"
        />
      </label>
      <button disabled={pending} type="submit">
        {pending ? 'Saving…' : 'Set'}
      </button>
      <span aria-live="polite" className="sr-only">
        {state.message}
      </span>
    </form>
  );
}

function TerminalLedger({ state }: { state: OwnedTerminalState }) {
  const [tab, setTab] = useState<
    'EXECUTIONS' | 'HISTORY' | 'ORDERS' | 'POSITIONS'
  >('POSITIONS');
  const newestExecutionId = state.executions[0]?.id;
  const hasReceivedInitialState = useRef(false);
  const priorExecutionId = useRef(newestExecutionId);
  useEffect(() => {
    if (
      hasReceivedInitialState.current &&
      newestExecutionId !== undefined &&
      newestExecutionId !== priorExecutionId.current
    ) {
      setTab('EXECUTIONS');
    }
    priorExecutionId.current = newestExecutionId;
    hasReceivedInitialState.current = true;
  }, [newestExecutionId]);
  const pendingOrders = state.orders.filter((order) =>
    ['ACCEPTED', 'PARTIALLY_FILLED'].includes(order.status),
  );
  return (
    <section className="terminal-ledger">
      <nav aria-label="Terminal ledger views" className="ledger-tabs">
        <button
          aria-pressed={tab === 'POSITIONS'}
          onClick={() => setTab('POSITIONS')}
          type="button"
        >
          Positions <span>{state.positions.length}</span>
        </button>
        <button
          aria-pressed={tab === 'ORDERS'}
          onClick={() => setTab('ORDERS')}
          type="button"
        >
          Pending <span>{pendingOrders.length}</span>
        </button>
        <button
          aria-pressed={tab === 'EXECUTIONS'}
          onClick={() => setTab('EXECUTIONS')}
          type="button"
        >
          Executions <span>{state.executions.length}</span>
        </button>
        <button
          aria-pressed={tab === 'HISTORY'}
          onClick={() => setTab('HISTORY')}
          type="button"
        >
          Closed trades <span>{state.closedTrades.length}</span>
        </button>
      </nav>
      <div className="ledger-scroll">
        {tab === 'POSITIONS' ? (
          state.positions.length === 0 ? (
            <p className="ledger-empty">
              No open positions. Use the server order ticket to start.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Avg entry</th>
                  <th>Mark</th>
                  <th>Live P&amp;L</th>
                  <th>Opened UTC</th>
                  <th>Protection</th>
                </tr>
              </thead>
              <tbody>
                {state.positions.map((position) => (
                  <tr key={position.id}>
                    <td>
                      <strong>{position.symbol}</strong>
                    </td>
                    <td
                      className={
                        position.side === 'LONG' ? 'positive' : 'negative'
                      }
                    >
                      {position.side}
                    </td>
                    <td>{position.quantity}</td>
                    <td>{position.averageEntryPrice}</td>
                    <td>{position.markPrice ?? 'Awaiting quote'}</td>
                    <td
                      className={
                        position.unrealizedPnlMinor?.startsWith('-')
                          ? 'negative'
                          : 'positive'
                      }
                    >
                      {position.unrealizedPnlMinor === null ? (
                        '—'
                      ) : (
                        <>
                          {signedMoney(position.unrealizedPnlMinor)}
                          <small>{position.unrealizedPips} pips</small>
                        </>
                      )}
                    </td>
                    <td>{dateTime(position.openedAt)}</td>
                    <td>
                      <ProtectionForm
                        accountId={state.account.id}
                        position={position}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
        {tab === 'ORDERS' ? (
          pendingOrders.length === 0 ? (
            <p className="ledger-empty">
              No pending orders are waiting on the server.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Submitted UTC</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Trigger</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{dateTime(order.submittedAt)}</td>
                    <td>
                      <strong>{order.symbol}</strong>
                    </td>
                    <td>{order.type}</td>
                    <td>{order.side}</td>
                    <td>{order.quantity}</td>
                    <td>
                      {order.limitPrice ??
                        order.stopPrice ??
                        order.stopLossPrice ??
                        order.takeProfitPrice ??
                        '—'}
                    </td>
                    <td>
                      <form action={cancelTerminalOrder}>
                        <input
                          name="accountId"
                          type="hidden"
                          value={state.account.id}
                        />
                        <input name="orderId" type="hidden" value={order.id} />
                        <button className="ledger-action" type="submit">
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
        {tab === 'EXECUTIONS' ? (
          state.executions.length === 0 ? (
            <p className="ledger-empty">No fills have been recorded.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Executed UTC</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Fill price</th>
                  <th>Execution ID</th>
                </tr>
              </thead>
              <tbody>
                {state.executions.map((execution) => (
                  <tr key={execution.id}>
                    <td>{dateTime(execution.executedAt)}</td>
                    <td>
                      <strong>{execution.symbol}</strong>
                    </td>
                    <td>{execution.side}</td>
                    <td>{execution.quantity}</td>
                    <td>{execution.price}</td>
                    <td>
                      <code>{execution.id.slice(0, 8)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
        {tab === 'HISTORY' ? (
          state.closedTrades.length === 0 ? (
            <p className="ledger-empty">
              Closed trade history will remain here after logout.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Closed UTC</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Realized P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {state.closedTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{dateTime(trade.closedAt)}</td>
                    <td>
                      <strong>{trade.symbol}</strong>
                    </td>
                    <td>{trade.side}</td>
                    <td>{trade.quantity}</td>
                    <td>{trade.entryPrice}</td>
                    <td>{trade.exitPrice}</td>
                    <td
                      className={
                        trade.realizedPnl.startsWith('-')
                          ? 'negative'
                          : 'positive'
                      }
                    >
                      {trade.realizedPnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>
    </section>
  );
}

export function TerminalWorkspace({
  historyAnchor,
  initialCandles,
  initialRenderedAt,
  initialSymbol,
  initialState,
  realtimeUrl,
}: {
  historyAnchor: string;
  initialCandles: TerminalChartCandle[];
  initialRenderedAt: string;
  initialSymbol: string;
  initialState: OwnedTerminalState;
  realtimeUrl: string;
}) {
  const [state, setState] = useState(initialState);
  const [selectedSymbol, setSelectedSymbol] = useState(() =>
    defaultSelectedSymbol(initialState),
  );
  const [orderDraft, setOrderDraft] = useState<TerminalOrderDraft | null>(null);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [connection, setConnection] = useState<ConnectionState>('CONNECTING');
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() =>
    new Date(initialRenderedAt).getTime(),
  );
  const [liveCandle, setLiveCandle] = useState<TerminalChartCandle | null>(
    null,
  );
  const [protectionState, updateChartProtection, protectionPending] =
    useActionState(updatePositionProtection, initialTerminalActionState);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSymbolStorageScope = useRef<string | null>(null);
  const selectedSymbolRef = useRef(selectedSymbol);
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshQueued = useRef(false);
  const refreshRequested = useRef(false);
  const terminalRef = useRef<HTMLElement>(null);

  useEffect(() => setState(initialState), [initialState]);
  useEffect(() => {
    const storageKey = selectedSymbolStorageKey(initialState.account.id);
    if (selectedSymbolStorageScope.current === storageKey) return;
    selectedSymbolStorageScope.current = storageKey;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (
        stored !== null &&
        initialState.instruments.some(
          (instrument) => instrument.symbol === stored,
        )
      ) {
        setSelectedSymbol(stored);
      }
    } catch {
      // Selected symbol is an optional local preference, never terminal authority.
    }
  }, [initialState.account.id, initialState.instruments]);
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
    setLiveCandle(null);
    setOrderDraft(null);
  }, [selectedSymbol]);

  const selectSymbol = useCallback(
    (symbol: string) => {
      if (
        !state.instruments.some((instrument) => instrument.symbol === symbol)
      ) {
        return;
      }
      setSelectedSymbol(symbol);
      try {
        window.localStorage.setItem(
          selectedSymbolStorageKey(state.account.id),
          symbol,
        );
      } catch {
        // Selected symbol is an optional local preference, never terminal authority.
      }
    },
    [state.account.id, state.instruments],
  );

  useEffect(() => {
    if (
      state.instruments.some(
        (instrument) => instrument.symbol === selectedSymbol,
      )
    ) {
      return;
    }
    selectSymbol(defaultSelectedSymbol(state));
  }, [selectSymbol, selectedSymbol, state]);

  const refreshState = useCallback(async () => {
    if (refreshQueued.current) {
      refreshRequested.current = true;
      return;
    }
    refreshQueued.current = true;
    try {
      do {
        refreshRequested.current = false;
        const response = await fetch(
          `/api/terminal/${encodeURIComponent(initialState.account.id)}/snapshot`,
          { cache: 'no-store' },
        );
        if (response.ok) {
          const payload = (await response.json()) as {
            state: OwnedTerminalState;
          };
          setState(payload.state);
        }
      } while (refreshRequested.current);
    } finally {
      refreshQueued.current = false;
    }
  }, [initialState.account.id]);

  useEffect(() => {
    function syncFullscreen() {
      setFullscreen(document.fullscreenElement === terminalRef.current);
    }
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (protectionState.status === 'SUCCESS') {
      void refreshState();
    }
  }, [protectionState.status, refreshState]);

  const updateProtectionFromChart = useCallback(
    (input: {
      kind: 'STOP_LOSS' | 'TAKE_PROFIT';
      position: OwnedTerminalState['positions'][number];
      price: string;
    }) => {
      const formData = new FormData();
      formData.set('accountId', state.account.id);
      formData.set('clientRequestId', crypto.randomUUID());
      formData.set('positionId', input.position.id);
      formData.set(
        'stopLossPrice',
        input.kind === 'STOP_LOSS'
          ? input.price
          : (input.position.stopLossPrice ?? ''),
      );
      formData.set(
        'takeProfitPrice',
        input.kind === 'TAKE_PROFIT'
          ? input.price
          : (input.position.takeProfitPrice ?? ''),
      );
      updateChartProtection(formData);
    },
    [state.account.id, updateChartProtection],
  );

  async function toggleFullscreen() {
    const terminal = terminalRef.current;
    if (terminal === null) return;
    try {
      if (document.fullscreenElement === terminal) {
        await document.exitFullscreen();
      } else {
        await terminal.requestFullscreen();
      }
    } catch {
      setFullscreen(false);
    }
  }

  useEffect(() => {
    let disposed = false;
    let attempts = 0;
    let websocket: WebSocket | null = null;
    function markActivity() {
      if (staleTimer.current !== null) clearTimeout(staleTimer.current);
      staleTimer.current = setTimeout(() => setConnection('STALE'), 15_000);
    }
    function connect() {
      if (disposed) return;
      setConnection(attempts === 0 ? 'CONNECTING' : 'OFFLINE');
      const url = new URL(realtimeUrl);
      url.searchParams.set('accountId', initialState.account.id);
      websocket = new WebSocket(url);
      websocket.onopen = () => {
        attempts = 0;
        websocket?.send('resync');
        markActivity();
      };
      websocket.onmessage = (event) => {
        markActivity();
        const message = JSON.parse(String(event.data)) as Record<
          string,
          unknown
        >;
        if (message.kind === 'snapshot') {
          setConnection('LIVE');
          void refreshState();
          return;
        }
        if (message.kind === 'quote') {
          setConnection('LIVE');
          setState((current) => ({
            ...current,
            quotes: current.quotes.map((quote) =>
              quote.symbol === message.symbol
                ? {
                    ask: String(message.ask),
                    bid: String(message.bid),
                    sequence: String(message.sequence),
                    status: 'LIVE',
                    symbol: quote.symbol,
                    timestamp: String(message.timestamp),
                  }
                : quote,
            ),
          }));
          return;
        }
        if (message.kind === 'account-state') {
          setConnection('LIVE');
          void refreshState();
          return;
        }
        if (
          message.kind === 'candle' &&
          message.symbol === selectedSymbolRef.current &&
          message.timeframe === '1m'
        ) {
          setLiveCandle({
            close: String(message.close),
            high: String(message.high),
            isFinal: Boolean(message.isFinal),
            low: String(message.low),
            open: String(message.open),
            openTime: String(message.openTime),
          });
        }
      };
      websocket.onerror = () => websocket?.close();
      websocket.onclose = () => {
        if (disposed) return;
        setConnection('OFFLINE');
        attempts += 1;
        reconnectTimer.current = setTimeout(
          connect,
          Math.min(10_000, 500 * 2 ** attempts),
        );
      };
    }
    connect();
    return () => {
      disposed = true;
      websocket?.close();
      if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
      if (staleTimer.current !== null) clearTimeout(staleTimer.current);
    };
  }, [initialState.account.id, realtimeUrl, refreshState]);

  const selectedQuote = state.quotes.find(
    (quote) => quote.symbol === selectedSymbol,
  );
  const selectedInstrument = state.instruments.find(
    (instrument) => instrument.symbol === selectedSymbol,
  );
  const armPendingOrder = useCallback(
    (side: 'BUY' | 'SELL', type: 'LIMIT' | 'STOP') => {
      if (
        selectedQuote?.status !== 'LIVE' ||
        selectedQuote.ask === null ||
        selectedQuote.bid === null ||
        selectedInstrument === undefined
      ) {
        return;
      }
      setOrderSide(side);
      setOrderDraft({
        price: defaultPendingOrderPrice({
          ask: selectedQuote.ask,
          bid: selectedQuote.bid,
          priceScale: selectedInstrument.priceScale,
          side,
          type,
        }),
        side,
        type,
      });
    },
    [selectedInstrument, selectedQuote],
  );
  const cancelPendingOrder = useCallback(() => setOrderDraft(null), []);
  const executionMarkers = useMemo(
    () =>
      state.executions.map((execution) => ({
        color: execution.side === 'BUY' ? '#82a8ff' : '#ff806d',
        position:
          execution.side === 'BUY'
            ? ('belowBar' as const)
            : ('aboveBar' as const),
        shape:
          execution.side === 'BUY'
            ? ('arrowUp' as const)
            : ('arrowDown' as const),
        text: `${execution.symbol} ${execution.side} ${execution.quantity}`,
        time: execution.executedAt,
      })),
    [state.executions],
  );
  const visibleMarkers = useMemo(
    () =>
      executionMarkers.filter((marker) =>
        marker.text.startsWith(selectedSymbol),
      ),
    [executionMarkers, selectedSymbol],
  );
  const drawdown = Number(state.metrics.currentDrawdownMinor);
  const drawdownLimit = Number(state.account.tier.maxDrawdownMinor);
  const drawdownPercent =
    drawdownLimit === 0 ? 0 : Math.min(100, (drawdown / drawdownLimit) * 100);
  const starts = new Date(state.account.competition.tradingStartsAt).getTime();
  const ends = new Date(state.account.competition.tradingEndsAt).getTime();
  const weekPercent = Math.max(
    0,
    Math.min(100, ((currentTime - starts) / Math.max(1, ends - starts)) * 100),
  );

  return (
    <main
      className={`terminal-page ${fullscreen ? 'is-fullscreen' : ''}`}
      ref={terminalRef}
    >
      <header className="terminal-command-bar">
        <div className="terminal-identity">
          <span className="data-label">
            {state.account.tier.code} / {state.account.competition.code}
          </span>
          <strong>{state.account.competition.name}</strong>
        </div>
        <div className="terminal-quote-strip">
          <span>{selectedSymbol}</span>
          <strong>{selectedQuote?.bid ?? '—'}</strong>
          <i>/</i>
          <strong>{selectedQuote?.ask ?? '—'}</strong>
          <small>
            Spread{' '}
            {liveSpreadPips(selectedQuote, selectedInstrument?.priceScale)}
          </small>
        </div>
        <div className={`connection-chip is-${connection.toLowerCase()}`}>
          <span />{' '}
          {connection === 'LIVE'
            ? 'Live market link'
            : connection.toLowerCase()}
        </div>
        <button
          aria-pressed={fullscreen}
          className="terminal-fullscreen-toggle"
          onClick={() => void toggleFullscreen()}
          type="button"
        >
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
      </header>

      <section className="risk-rail" aria-label="Competition risk rail">
        <div className="risk-rail-track">
          <span style={{ width: `${weekPercent}%` }} />
        </div>
        <div>
          <span>Week cutoff</span>
          <strong>{dateTime(state.account.competition.tradingEndsAt)}</strong>
        </div>
        <div>
          <span>Drawdown used</span>
          <strong>
            {money(state.metrics.currentDrawdownMinor)} /{' '}
            {money(state.account.tier.maxDrawdownMinor)}
          </strong>
        </div>
        <div
          className="drawdown-meter"
          aria-label={`${drawdownPercent.toFixed(1)} percent of drawdown limit used`}
        >
          <span style={{ width: `${drawdownPercent}%` }} />
        </div>
        <div>
          <span>Headroom</span>
          <strong>{money(state.metrics.drawdownRemainingMinor)}</strong>
        </div>
      </section>

      <section className="terminal-metrics" aria-label="Account metrics">
        <div>
          <span>Balance</span>
          <strong>{money(state.account.balanceMinor)}</strong>
        </div>
        <div>
          <span>Equity</span>
          <strong>{money(state.metrics.equityMinor)}</strong>
        </div>
        <div>
          <span>Unrealized</span>
          <strong
            className={
              state.metrics.unrealizedPnlMinor.startsWith('-')
                ? 'negative'
                : 'positive'
            }
          >
            {signedMoney(state.metrics.unrealizedPnlMinor)}
          </strong>
        </div>
        <div>
          <span>Margin used</span>
          <strong>{money(state.metrics.marginUsedMinor)}</strong>
        </div>
        <div>
          <span>Free margin</span>
          <strong>{money(state.metrics.marginFreeMinor)}</strong>
        </div>
      </section>

      <section className="terminal-work-grid">
        <TerminalChart
          accountId={state.account.id}
          canEditProtection={
            state.account.status === 'ACTIVE' &&
            connection === 'LIVE' &&
            !protectionPending
          }
          historyAnchor={historyAnchor}
          initialCandles={initialCandles}
          initialSymbol={initialSymbol}
          liveCandle={liveCandle}
          markers={visibleMarkers}
          onOrderDraftPriceChange={(price) =>
            setOrderDraft((current) =>
              current === null ? null : { ...current, price },
            )
          }
          onOrderSideSelect={setOrderSide}
          onProtectionDrop={updateProtectionFromChart}
          orderDraft={orderDraft}
          orderSide={orderSide}
          positions={state.positions}
          protectionMessage={protectionState.message}
          quote={state.quotes.find(
            (candidate) => candidate.symbol === selectedSymbol,
          )}
          symbol={selectedSymbol}
        />
        <TerminalInstrumentRail
          accountId={state.account.id}
          instruments={state.instruments}
          quotes={state.quotes}
          selectedSymbol={selectedSymbol}
          setSelectedSymbol={selectSymbol}
        />
        <TerminalOrderTicket
          accountActive={state.account.status === 'ACTIVE'}
          accountId={state.account.id}
          connectionLive={connection === 'LIVE'}
          instruments={state.instruments}
          onArmPendingOrder={armPendingOrder}
          onCancelPendingOrder={cancelPendingOrder}
          onRefresh={refreshState}
          orderDraft={orderDraft}
          orderSide={orderSide}
          quotes={state.quotes}
          selectedSymbol={selectedSymbol}
          setOrderSide={setOrderSide}
          setSelectedSymbol={selectSymbol}
        />
      </section>
      <TerminalLedger state={state} />
      <p className="terminal-disclosure">
        Fictitious competition capital only · no deposits · no live brokerage
        execution
      </p>
    </main>
  );
}
