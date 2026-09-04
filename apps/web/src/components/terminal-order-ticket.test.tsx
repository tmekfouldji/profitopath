/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/terminal/[accountId]/actions', () => ({
  submitTerminalOrder: vi.fn(),
}));

import { TerminalOrderTicket } from './terminal-order-ticket';

const instruments = [
  {
    minimumQuantity: '0.01',
    priceScale: 5,
    quantityStep: '0.01',
    symbol: 'EURUSD',
  },
];

const liveQuotes = [
  {
    ask: '1.10020',
    bid: '1.10000',
    status: 'LIVE' as const,
    symbol: 'EURUSD',
    timestamp: '2026-08-24T09:00:00.000Z',
  },
];

function TicketHarness({ connectionLive }: { connectionLive: boolean }) {
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderDraft, setOrderDraft] = useState<{
    price: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'STOP';
  } | null>(null);
  return createElement(TerminalOrderTicket, {
    accountActive: true,
    accountId: 'account-1',
    connectionLive,
    instruments,
    onArmPendingOrder: (side, type) =>
      setOrderDraft({ price: '1.09900', side, type }),
    onCancelPendingOrder: () => setOrderDraft(null),
    onRefresh: vi.fn(),
    orderDraft,
    orderSide,
    quotes: liveQuotes,
    selectedSymbol: 'EURUSD',
    setOrderSide,
    setSelectedSymbol: vi.fn(),
  });
}

function ticket(connectionLive: boolean) {
  return createElement(TicketHarness, { connectionLive });
}

afterEach(cleanup);

describe('terminal order ticket browser state', () => {
  it('keeps submission disabled and visibly paused without a live server link', () => {
    render(ticket(false));

    expect(screen.getByText('Execution paused')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Buy market' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('enables the server action only for an active account and live quote', () => {
    render(ticket(true));

    expect(screen.getByText('Server ready')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Buy market' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(screen.getAllByText('1.10020')).toHaveLength(1);
  });

  it('arms a provisional chart-priced order instead of submitting when limit is selected', () => {
    const { container } = render(ticket(true));
    const form = container.querySelector('form');
    const submit = vi.fn();
    form?.addEventListener('submit', submit);

    fireEvent.click(screen.getByRole('button', { name: 'Buy limit' }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Buy limit')).toHaveLength(2);
    expect(screen.getByText('1.09900')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Place Buy limit' }),
    ).toBeTruthy();
  });
});
