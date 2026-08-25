'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { initialTerminalActionState } from '@/app/terminal/[accountId]/action-state';
import {
  cancelTerminalOrder,
  updatePositionProtection,
} from '@/app/terminal/[accountId]/actions';
import type { OwnedTerminalState } from '@/server/terminal-read-model';

import {
  TerminalChart,
  type TerminalChartCandle,
  type TerminalChartMarker,
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
  markers,
  realtimeUrl,
}: {
  historyAnchor: string;
  initialCandles: TerminalChartCandle[];
  initialRenderedAt: string;
  initialSymbol: string;
  initialState: OwnedTerminalState;
  markers: TerminalChartMarker[];
  realtimeUrl: string;
}) {
  const [state, setState] = useState(initialState);
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialState.positions[0]?.symbol ??
      initialState.instruments[0]?.symbol ??
      'EURUSD',
  );
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
  const selectedSymbolRef = useRef(selectedSymbol);
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshQueued = useRef(false);
  const terminalRef = useRef<HTMLElement>(null);

  useEffect(() => setState(initialState), [initialState]);
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
    setLiveCandle(null);
  }, [selectedSymbol]);

  const refreshState = useCallback(async () => {
    if (refreshQueued.current) {
      return;
    }
    refreshQueued.current = true;
    try {
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
  const visibleMarkers = useMemo(
    () => markers.filter((marker) => marker.text.startsWith(selectedSymbol)),
    [markers, selectedSymbol],
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
        </div>
        <div className={`connection-chip is-${connection.toLowerCase()}`}>
          <span />{' '}
          {connection === 'LIVE' ? 'Live mock link' : connection.toLowerCase()}
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
          onOrderSideSelect={setOrderSide}
          onProtectionDrop={updateProtectionFromChart}
          orderSide={orderSide}
          positions={state.positions}
          protectionMessage={protectionState.message}
          quote={state.quotes.find(
            (candidate) => candidate.symbol === selectedSymbol,
          )}
          symbol={selectedSymbol}
        />
        <TerminalOrderTicket
          accountActive={state.account.status === 'ACTIVE'}
          accountId={state.account.id}
          connectionLive={connection === 'LIVE'}
          instruments={state.instruments}
          onRefresh={refreshState}
          orderSide={orderSide}
          quotes={state.quotes}
          selectedSymbol={selectedSymbol}
          setOrderSide={setOrderSide}
          setSelectedSymbol={setSelectedSymbol}
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
