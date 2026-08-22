/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
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

function ticket(connectionLive: boolean) {
  return createElement(TerminalOrderTicket, {
    accountActive: true,
    accountId: 'account-1',
    connectionLive,
    instruments,
    onRefresh: vi.fn(),
    quotes: liveQuotes,
    selectedSymbol: 'EURUSD',
    setSelectedSymbol: vi.fn(),
  });
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
});
