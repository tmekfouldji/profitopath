'use client';

import { useActionState, useEffect, useState } from 'react';

import { initialTerminalActionState } from '@/app/terminal/[accountId]/action-state';
import { submitTerminalOrder } from '@/app/terminal/[accountId]/actions';

import type { TerminalOrderDraft } from './terminal-chart';

interface TicketInstrument {
  minimumQuantity: string;
  priceScale: number;
  quantityStep: string;
  symbol: string;
}

interface TicketQuote {
  ask: string | null;
  bid: string | null;
  status: 'LIVE' | 'MISSING';
  symbol: string;
  timestamp: string | null;
}

function intentFor(draft: TerminalOrderDraft): string {
  return `${draft.side}_${draft.type}`;
}

function orderLabel(draft: TerminalOrderDraft): string {
  return `${draft.side === 'BUY' ? 'Buy' : 'Sell'} ${draft.type.toLowerCase()}`;
}

export function TerminalOrderTicket({
  accountActive,
  accountId,
  connectionLive,
  instruments,
  onArmPendingOrder,
  onCancelPendingOrder,
  onRefresh,
  orderDraft,
  orderSide,
  quotes,
  selectedSymbol,
  setOrderSide,
  setSelectedSymbol,
}: {
  accountActive: boolean;
  accountId: string;
  connectionLive: boolean;
  instruments: TicketInstrument[];
  onArmPendingOrder(side: 'BUY' | 'SELL', type: 'LIMIT' | 'STOP'): void;
  onCancelPendingOrder(): void;
  onRefresh(): Promise<void>;
  orderDraft: TerminalOrderDraft | null;
  orderSide: 'BUY' | 'SELL';
  quotes: TicketQuote[];
  selectedSymbol: string;
  setOrderSide(side: 'BUY' | 'SELL'): void;
  setSelectedSymbol(symbol: string): void;
}) {
  const [state, action, pending] = useActionState(
    submitTerminalOrder,
    initialTerminalActionState,
  );
  const [clientOrderId, setClientOrderId] = useState(() => crypto.randomUUID());
  const quote = quotes.find((candidate) => candidate.symbol === selectedSymbol);
  const instrument = instruments.find(
    (candidate) => candidate.symbol === selectedSymbol,
  );
  const canTrade =
    accountActive && connectionLive && quote?.status === 'LIVE' && !pending;
  const canBuyBid = canTrade && quote?.bid !== null;
  const canSellAsk = canTrade && quote?.ask !== null;

  useEffect(() => {
    if (state.status === 'SUCCESS') {
      setClientOrderId(crypto.randomUUID());
      onCancelPendingOrder();
      void onRefresh();
    }
  }, [onCancelPendingOrder, onRefresh, state]);

  function armPendingOrder(side: 'BUY' | 'SELL', type: 'LIMIT' | 'STOP') {
    setOrderSide(side);
    onArmPendingOrder(side, type);
  }

  return (
    <aside className="order-ticket" aria-label="Simulated order ticket">
      <header className="ticket-heading">
        <div>
          <span className="data-label">New simulated order</span>
          <strong>{selectedSymbol}</strong>
        </div>
        <span className={`market-state ${canTrade ? 'is-live' : 'is-stale'}`}>
          {canTrade ? 'Server ready' : 'Execution paused'}
        </span>
      </header>
      <form action={action} className="ticket-form">
        <input name="accountId" type="hidden" value={accountId} />
        <input name="clientOrderId" type="hidden" value={clientOrderId} />
        <input name="side" type="hidden" value={orderSide} />
        <input name="type" type="hidden" value="MARKET" />
        <input
          name="bidPrice"
          readOnly
          type="hidden"
          value={quote?.bid ?? ''}
        />
        <input
          name="askPrice"
          readOnly
          type="hidden"
          value={quote?.ask ?? ''}
        />
        <input
          name="price"
          readOnly
          type="hidden"
          value={orderDraft?.price ?? ''}
        />
        <label>
          Symbol
          <select
            name="symbol"
            onChange={(event) => setSelectedSymbol(event.target.value)}
            value={selectedSymbol}
          >
            {instruments.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input
            defaultValue={instrument?.minimumQuantity ?? '0.01'}
            inputMode="decimal"
            min={instrument?.minimumQuantity}
            name="quantity"
            required
            step={instrument?.quantityStep}
          />
          <small>
            Min {instrument?.minimumQuantity ?? '—'} · step{' '}
            {instrument?.quantityStep ?? '—'}
          </small>
        </label>
        <section
          aria-label="Execution actions"
          className="execution-action-grid"
        >
          <div className="execution-action-column is-buy">
            <button
              disabled={!canBuyBid}
              name="orderIntent"
              onClick={() => setOrderSide('BUY')}
              type="submit"
              value="BUY_BID"
            >
              <span>Buy bid</span>
              <b>{quote?.bid ?? '—'}</b>
            </button>
            <button
              disabled={!canTrade}
              name="orderIntent"
              onClick={() => setOrderSide('BUY')}
              type="submit"
              value="BUY_MARKET"
            >
              Buy market
            </button>
            <button
              disabled={!canTrade}
              onClick={() => armPendingOrder('BUY', 'LIMIT')}
              type="button"
            >
              Buy limit
            </button>
            <button
              disabled={!canTrade}
              onClick={() => armPendingOrder('BUY', 'STOP')}
              type="button"
            >
              Buy stop
            </button>
          </div>
          <div className="execution-action-column is-sell">
            <button
              disabled={!canSellAsk}
              name="orderIntent"
              onClick={() => setOrderSide('SELL')}
              type="submit"
              value="SELL_ASK"
            >
              <span>Sell ask</span>
              <b>{quote?.ask ?? '—'}</b>
            </button>
            <button
              disabled={!canTrade}
              name="orderIntent"
              onClick={() => setOrderSide('SELL')}
              type="submit"
              value="SELL_MARKET"
            >
              Sell market
            </button>
            <button
              disabled={!canTrade}
              onClick={() => armPendingOrder('SELL', 'LIMIT')}
              type="button"
            >
              Sell limit
            </button>
            <button
              disabled={!canTrade}
              onClick={() => armPendingOrder('SELL', 'STOP')}
              type="button"
            >
              Sell stop
            </button>
          </div>
        </section>
        {orderDraft === null ? null : (
          <section aria-live="polite" className="pending-order-draft">
            <div>
              <strong>{orderLabel(orderDraft)}</strong>
              <span>{orderDraft.price}</span>
              <small>Drag the amber chart line to choose the trigger.</small>
            </div>
            <div>
              <button
                className={
                  orderDraft.side === 'BUY' ? 'button-buy' : 'button-sell'
                }
                disabled={!canTrade}
                name="orderIntent"
                type="submit"
                value={intentFor(orderDraft)}
              >
                {pending
                  ? 'Sending to server…'
                  : `Place ${orderLabel(orderDraft)}`}
              </button>
              <button onClick={onCancelPendingOrder} type="button">
                Cancel
              </button>
            </div>
          </section>
        )}
        <p
          aria-live="polite"
          className={`ticket-message is-${state.status.toLowerCase()}`}
        >
          {state.message ||
            'Market orders fill at the server quote. Limit and stop prices remain provisional until placed.'}
        </p>
      </form>
    </aside>
  );
}
