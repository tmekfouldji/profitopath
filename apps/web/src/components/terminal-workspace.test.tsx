/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
    markers: Array<{ text: string }>;
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
      createElement(
        'output',
        { 'data-testid': 'terminal-markers' },
        props.markers.map((marker) => marker.text).join(', '),
      ),
    ),
}));

vi.mock('./terminal-order-ticket', () => ({
  TerminalOrderTicket: () =>
    createElement('div', { 'data-testid': 'order-ticket' }, 'ticket'),
}));

class TestWebSocket {
  static latest: TestWebSocket | undefined;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor() {
    TestWebSocket.latest = this;
  }

  close() {}
  send() {}

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
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
  TestWebSocket.latest = undefined;
  window.localStorage.clear();
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
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    expect(screen.getByText('Avg entry')).toBeTruthy();
    expect(screen.getByText('Live P&L')).toBeTruthy();
    expect(screen.getByRole('cell', { name: '1.10020' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '1.10000' })).toBeTruthy();
    expect(screen.getAllByText('-$2.00')).toHaveLength(2);
    expect(screen.getByText('-2.0 pips')).toBeTruthy();
    expect(screen.getByText('Spread 2.0 pips')).toBeTruthy();
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
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

    expect(mocks.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('shows a server-confirmed execution as soon as its realtime signal arrives', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    const executedState: OwnedTerminalState = {
      ...state,
      executions: [
        {
          executedAt: '2026-08-24T09:00:01.000Z',
          id: 'execution-1',
          orderId: 'order-1',
          price: '1.10020',
          quantity: '0.10',
          side: 'BUY',
          symbol: 'EURUSD',
        },
      ],
    };
    const snapshot = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ state: executedState }),
      ok: true,
    });
    vi.stubGlobal('fetch', snapshot);
    const { TerminalWorkspace } = await import('./terminal-workspace');

    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: state,
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    await waitFor(() => expect(TestWebSocket.latest).toBeDefined());
    await act(async () => {
      TestWebSocket.latest?.emit({
        kind: 'account-state',
        sequence: '2',
        symbol: 'EURUSD',
        timestamp: '2026-08-24T09:00:01.000Z',
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('terminal-markers').textContent).toContain(
        'EURUSD BUY 0.10',
      ),
    );
    expect(snapshot).toHaveBeenCalledOnce();
    expect(screen.getByText('Executed UTC')).toBeTruthy();
  });

  it('stores starred configured instruments and brings them to the top of the rail', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    const configuredState: OwnedTerminalState = {
      ...state,
      instruments: [
        ...state.instruments,
        {
          minimumQuantity: '0.01',
          priceScale: 5,
          quantityStep: '0.01',
          symbol: 'GBPUSD',
        },
      ],
      quotes: [
        ...state.quotes,
        {
          ask: '1.28020',
          bid: '1.28000',
          sequence: '1',
          status: 'LIVE',
          symbol: 'GBPUSD',
          timestamp: '2026-08-24T09:00:00.000Z',
        },
      ],
    };
    const { TerminalWorkspace } = await import('./terminal-workspace');

    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: configuredState,
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add GBPUSD to favorites' }),
    );

    expect(
      JSON.parse(
        window.localStorage.getItem(
          'profitopath:terminal-favorites:v1:account-1',
        ) ?? '[]',
      ),
    ).toEqual(['GBPUSD']);
    expect(
      screen.getByLabelText('Instrument watchlist').querySelector('li')
        ?.textContent,
    ).toContain('GBPUSD');
  });

  it('restores the last selected active instrument after a terminal refresh', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    const configuredState: OwnedTerminalState = {
      ...state,
      instruments: [
        ...state.instruments,
        {
          minimumQuantity: '0.01',
          priceScale: 5,
          quantityStep: '0.01',
          symbol: 'GBPUSD',
        },
      ],
      quotes: [
        ...state.quotes,
        {
          ask: '1.28020',
          bid: '1.28000',
          sequence: '1',
          status: 'LIVE',
          symbol: 'GBPUSD',
          timestamp: '2026-08-24T09:00:00.000Z',
        },
      ],
    };
    const { TerminalWorkspace } = await import('./terminal-workspace');
    const first = render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: configuredState,
        realtimeUrl: 'ws://localhost:3001',
      }),
    );
    const firstWatchlist = screen.getByLabelText('Instrument watchlist');

    fireEvent.click(
      within(firstWatchlist).getByRole('button', {
        name: /GBPUSD1\.280001\.280202\.0 pips/,
      }),
    );
    expect(
      window.localStorage.getItem(
        'profitopath:terminal-selected-symbol:v1:account-1',
      ),
    ).toBe('GBPUSD');

    first.unmount();
    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: configuredState,
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Instrument watchlist'))
          .getByRole('button', { name: /GBPUSD1\.280001\.280202\.0 pips/ })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });

  it('ignores a stale selected-symbol preference that is no longer active', async () => {
    mocks.updatePositionProtection.mockResolvedValue({
      message: '',
      status: 'IDLE',
    });
    window.localStorage.setItem(
      'profitopath:terminal-selected-symbol:v1:account-1',
      'GBPUSD',
    );
    const { TerminalWorkspace } = await import('./terminal-workspace');

    render(
      createElement(TerminalWorkspace, {
        historyAnchor: '2026-08-24T12:00:00.000Z',
        initialCandles: [],
        initialRenderedAt: '2026-08-24T12:00:00.000Z',
        initialSymbol: 'EURUSD',
        initialState: state,
        realtimeUrl: 'ws://localhost:3001',
      }),
    );

    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Instrument watchlist'))
          .getByRole('button', { name: /EURUSD1\.100001\.100202\.0 pips/ })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    );
  });
});
