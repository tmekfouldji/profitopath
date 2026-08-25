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
  return createElement(TerminalOrderTicket, {
    accountActive: true,
    accountId: 'account-1',
    connectionLive,
    instruments,
    onRefresh: vi.fn(),
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

  it('treats quote Buy/Sell controls as side selection, never form submission', () => {
    const { container } = render(ticket(true));
    const form = container.querySelector('form');
    const submit = vi.fn();
    form?.addEventListener('submit', submit);

    fireEvent.click(screen.getByRole('button', { name: /sell \/ bid/i }));

    expect(submit).not.toHaveBeenCalled();
    expect(
      container.querySelector('input[name="side"]')?.getAttribute('value'),
    ).toBe('SELL');
  });
});
