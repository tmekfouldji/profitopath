'use client';

import { useActionState, useEffect, useState } from 'react';

import { initialTerminalActionState } from '@/app/terminal/[accountId]/action-state';
import { submitTerminalOrder } from '@/app/terminal/[accountId]/actions';

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

export function TerminalOrderTicket({
  accountActive,
  accountId,
  connectionLive,
  instruments,
  onRefresh,
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
  onRefresh(): Promise<void>;
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
  const [type, setType] = useState<'LIMIT' | 'MARKET' | 'STOP'>('MARKET');
  const quote = quotes.find((candidate) => candidate.symbol === selectedSymbol);
  const instrument = instruments.find(
    (candidate) => candidate.symbol === selectedSymbol,
  );
  const canTrade =
    accountActive && connectionLive && quote?.status === 'LIVE' && !pending;

  useEffect(() => {
    if (state.status === 'SUCCESS') {
      setClientOrderId(crypto.randomUUID());
      void onRefresh();
    }
  }, [onRefresh, state]);

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
      <div className="quote-dealing-box" aria-label={`${selectedSymbol} quote`}>
        <button onClick={() => setOrderSide('SELL')} type="button">
          <span>Sell / bid</span>
          <strong>{quote?.bid ?? '—'}</strong>
        </button>
        <button onClick={() => setOrderSide('BUY')} type="button">
          <span>Buy / ask</span>
          <strong>{quote?.ask ?? '—'}</strong>
        </button>
      </div>
      <form action={action} className="ticket-form">
        <input name="accountId" type="hidden" value={accountId} />
        <input name="clientOrderId" type="hidden" value={clientOrderId} />
        <input name="side" type="hidden" value={orderSide} />
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
        <fieldset className="order-type-switcher">
          <legend>Order type</legend>
          {(['MARKET', 'LIMIT', 'STOP'] as const).map((option) => (
            <label key={option}>
              <input
                checked={type === option}
                name="type"
                onChange={() => setType(option)}
                type="radio"
                value={option}
              />
              <span>{option.toLowerCase()}</span>
            </label>
          ))}
        </fieldset>
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
        {type !== 'MARKET' ? (
          <label>
            Trigger price
            <input
              defaultValue={
                orderSide === 'BUY' ? (quote?.ask ?? '') : (quote?.bid ?? '')
              }
              inputMode="decimal"
              key={`${selectedSymbol}:${orderSide}:${type}`}
              name="price"
              required
              step={
                instrument === undefined
                  ? '0.00001'
                  : `0.${'0'.repeat(instrument.priceScale - 1)}1`
              }
            />
          </label>
        ) : (
          <input name="price" type="hidden" value="" />
        )}
        <div className="side-switcher" aria-label="Order side">
          <button
            aria-pressed={orderSide === 'SELL'}
            className={orderSide === 'SELL' ? 'is-sell' : ''}
            onClick={() => setOrderSide('SELL')}
            type="button"
          >
            Sell
          </button>
          <button
            aria-pressed={orderSide === 'BUY'}
            className={orderSide === 'BUY' ? 'is-buy' : ''}
            onClick={() => setOrderSide('BUY')}
            type="button"
          >
            Buy
          </button>
        </div>
        <button
          className={`button ${
            orderSide === 'BUY' ? 'button-buy' : 'button-sell'
          }`}
          disabled={!canTrade}
          type="submit"
        >
          {pending
            ? 'Sending to server…'
            : `${orderSide === 'BUY' ? 'Buy' : 'Sell'} ${type.toLowerCase()}`}
        </button>
        <p
          aria-live="polite"
          className={`ticket-message is-${state.status.toLowerCase()}`}
        >
          {state.message ||
            'Fills, margin checks, and triggers are decided by the server.'}
        </p>
      </form>
    </aside>
  );
}
