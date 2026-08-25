/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OwnedTerminalState } from '@/server/terminal-read-model';

const mocks = vi.hoisted(() => ({
  requestFullscreen: vi.fn(),
  updatePositionProtection: vi.fn(),
}));

vi.mock('@/app/terminal/[accountId]/actions', () => ({
  cancelTerminalOrder: vi.fn(),
  updatePositionProtection: mocks.updatePositionProtection,
}));

vi.mock('./terminal-chart', () => ({
  TerminalChart: (props: {
    positions: Array<{
      averageEntryPrice: string;
      markPrice: string | null;
      takeProfitPrice: string | null;
    }>;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'terminal-chart' },
      props.positions.map((position) =>
        createElement(
          'span',
          { key: position.averageEntryPrice },
          `${position.averageEntryPrice}/${position.markPrice}/${position.takeProfitPrice}`,
        ),
      ),
    ),
}));

vi.mock('./terminal-order-ticket', () => ({
  TerminalOrderTicket: () =>
    createElement('div', { 'data-testid': 'order-ticket' }, 'ticket'),
}));

class TestWebSocket {
  close() {}
  send() {}
}

const state: OwnedTerminalState = {
  account: {
    balanceMinor: '1000000',
    breachedAt: null,
    competition: {
      code: 'WEEK-1',
      name: 'Terminal test week',
      tradingEndsAt: '2026-08-28T17:00:00.000Z',
      tradingStartsAt: '2026-08-24T08:00:00.000Z',
    },
    configVersion: 1,
    id: 'account-1',
    realizedPnlMinor: '0',
    startingBalanceMinor: '1000000',
    status: 'ACTIVE',
    tier: { code: 'ROOKIE', maxDrawdownMinor: '100000', name: 'Rookie' },
  },
  closedTrades: [],
  executions: [],
  instruments: [
    {
      minimumQuantity: '0.01',
      priceScale: 5,
      quantityStep: '0.01',
      symbol: 'EURUSD',
    },
  ],
  metrics: {
    asOf: '2026-08-24T09:00:00.000Z',
    currentDrawdownMinor: '200',
    drawdownRemainingMinor: '99800',
    equityMinor: '999800',
    marginFreeMinor: '988800',
    marginUsedMinor: '11000',
    maxDrawdownMinor: '200',
    unrealizedPnlMinor: '-200',
  },
  orders: [],
  positions: [
    {
      averageEntryPrice: '1.10020',
      id: 'position-1',
      markPrice: '1.10000',
      openedAt: '2026-08-24T09:00:00.000Z',
      priceScale: 5,
      quantity: '0.10',
      realizedPnl: '0',
      side: 'LONG',
      stopLossPrice: '1.09900',
      symbol: 'EURUSD',
      takeProfitPrice: '1.10200',
      unrealizedPips: '-2.0',
      unrealizedPnlMinor: '-200',
    },
  ],
  quotes: [
    {
      ask: '1.10020',
      bid: '1.10000',
      sequence: '1',
      status: 'LIVE',
      symbol: 'EURUSD',
      timestamp: '2026-08-24T09:00:00.000Z',
    },
  ],
  version: '1',
};

vi.stubGlobal('WebSocket', TestWebSocket);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('terminal workstation presentation', () => {
  it('surfaces exact live position data and forwards the chart position to controls', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    const { TerminalWorkspace } = await import('./terminal-workspace');

    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: state,
        markers: [],
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    expect(screen.getByText('Avg entry')).toBeTruthy();
    expect(screen.getByText('Live P&L')).toBeTruthy();
    expect(screen.getByRole('cell', { name: '1.10020' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '1.10000' })).toBeTruthy();
    expect(screen.getAllByText('-$2.00')).toHaveLength(2);
    expect(screen.getByText('-2.0 pips')).toBeTruthy();
    expect(screen.getByTestId('terminal-chart').textContent).toContain(
      '1.10020/1.10000/1.10200',
    );
  });

  it('requests browser full screen only after the trader activates the command', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    mocks.requestFullscreen.mockResolvedValue(undefined);
    const { TerminalWorkspace } = await import('./terminal-workspace');
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: mocks.requestFullscreen,
    });

    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: state,
        markers: [],
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

    expect(mocks.requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
