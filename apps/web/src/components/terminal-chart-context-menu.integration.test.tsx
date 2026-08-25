/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chartApi = {
  addSeries: vi.fn(),
  applyOptions: vi.fn(),
  remove: vi.fn(),
  timeScale: vi.fn(),
};

const candleSeries = {
  applyOptions: vi.fn(),
  coordinateToPrice: vi.fn(() => 1.08432),
  priceToCoordinate: vi.fn((): number | null => null),
  setData: vi.fn(),
};

const requestChartFullscreen = vi.fn();
const onOrderSideSelect = vi.fn();

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'candlestick',
  ColorType: { Solid: 'solid' },
  createChart: vi.fn(() => chartApi),
  createSeriesMarkers: vi.fn(),
  LineSeries: 'line',
}));

import { TerminalChart } from './terminal-chart';

afterEach(() => {
  cleanup();
  chartApi.addSeries.mockReset();
  chartApi.applyOptions.mockReset();
  chartApi.remove.mockReset();
  chartApi.timeScale.mockReset();
  candleSeries.applyOptions.mockReset();
  candleSeries.coordinateToPrice.mockClear();
  candleSeries.priceToCoordinate.mockClear();
  candleSeries.setData.mockReset();
});

beforeEach(() => {
  window.localStorage.clear();
  requestChartFullscreen.mockReset();
  onOrderSideSelect.mockReset();
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestChartFullscreen,
  });
});

function renderChart({
  candleCount = 1,
  futureSpace = false,
}: {
  candleCount?: number;
  futureSpace?: boolean;
} = {}) {
  chartApi.addSeries.mockImplementation(() => candleSeries);
  candleSeries.priceToCoordinate.mockReturnValue(futureSpace ? 120 : null);
  chartApi.timeScale.mockImplementation(() => ({
    coordinateToLogical: () => (futureSpace ? 4 : 0),
    coordinateToTime: () => (futureSpace ? null : 1_723_967_200),
    fitContent: vi.fn(),
    logicalToCoordinate: (logical: number) =>
      futureSpace ? logical * 40 : null,
    scrollToRealTime: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn(),
    timeToIndex: () => 0,
    timeToCoordinate: () => null,
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  }));

  render(
    createElement(TerminalChart, {
      accountId: 'account-1',
      canEditProtection: false,
      historyAnchor: '2024-08-14T12:00:00.000Z',
      initialCandles: Array.from({ length: candleCount }, (_, index) => ({
        close: '1.08432',
        high: '1.08500',
        isFinal: true,
        low: '1.08300',
        open: '1.08400',
        openTime: new Date(Date.UTC(2024, 7, 14, 12, index)).toISOString(),
      })),
      initialSymbol: 'EURUSD',
      liveCandle: null,
      markers: [],
      onOrderSideSelect,
      onProtectionDrop: vi.fn(),
      orderSide: 'BUY',
      positions: [],
      protectionMessage: '',
      quote: {
        ask: '1.08452',
        bid: '1.08432',
        status: 'LIVE',
        symbol: 'EURUSD',
      },
      symbol: 'EURUSD',
    }),
  );
}

describe('terminal chart context-menu integration', () => {
  it('opens the command menu on right-click and adds a local horizontal ray at that chart point', () => {
    renderChart();

    fireEvent.contextMenu(
      screen.getByLabelText('EURUSD interactive chart canvas'),
      { clientX: 160, clientY: 180 },
    );

    const menu = screen.getByLabelText('Chart command menu');

    expect(menu).toBeTruthy();
    expect(screen.getByText(/1\.08432/)).toBeTruthy();

    fireEvent.click(
      within(menu).getByRole('button', { name: 'Open drawing tools' }),
    );

    fireEvent.click(
      within(menu).getByRole('button', { name: 'Horizontal ray' }),
    );

    expect(screen.queryByLabelText('Chart command menu')).toBeNull();
    expect(screen.getByText(/1 browser drawing/)).toBeTruthy();
  });

  it('opens the same command menu from the keyboard context-menu shortcut', () => {
    renderChart();

    fireEvent.keyDown(
      screen.getByLabelText('EURUSD interactive chart canvas'),
      {
        key: 'F10',
        shiftKey: true,
      },
    );

    expect(screen.getByLabelText('Chart command menu')).toBeTruthy();
  });

  it('permits a drawing in future chart space beyond the latest candle', () => {
    renderChart({ futureSpace: true });

    fireEvent.contextMenu(
      screen.getByLabelText('EURUSD interactive chart canvas'),
      { clientX: 160, clientY: 180 },
    );

    const menu = screen.getByLabelText('Chart command menu');
    fireEvent.click(
      within(menu).getByRole('button', { name: 'Open drawing tools' }),
    );
    fireEvent.click(
      within(menu).getByRole('button', { name: 'Horizontal ray' }),
    );

    expect(screen.getByText('1 browser drawing · select to edit')).toBeTruthy();
  });

  it('requests browser fullscreen for the chart panel only', () => {
    renderChart();

    fireEvent.click(screen.getByRole('button', { name: 'Chart full screen' }));

    expect(requestChartFullscreen).toHaveBeenCalledTimes(1);
  });

  it('lists each applied study with its configured parameters and latest value in the chart pane', () => {
    renderChart({ candleCount: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Studies' }));
    fireEvent.click(screen.getByLabelText('Simple moving average visibility'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    const legend = screen.getByLabelText('Active chart studies');
    expect(within(legend).getByText('SMA 20')).toBeTruthy();
    expect(within(legend).getByText('1.08432')).toBeTruthy();
  });

  it('shows optional chart quote selectors and routes a side choice without submitting', () => {
    renderChart();

    fireEvent.contextMenu(
      screen.getByLabelText('EURUSD interactive chart canvas'),
      { clientX: 160, clientY: 180 },
    );
    const menu = screen.getByLabelText('Chart command menu');
    fireEvent.click(
      within(menu).getByRole('button', { name: 'Open chart settings' }),
    );
    fireEvent.click(
      within(menu).getByRole('button', { name: 'Show Buy/Sell buttons' }),
    );

    expect(screen.getByLabelText('Chart Buy/Sell selectors')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Select Sell / bid 1.08432' }),
    );

    expect(onOrderSideSelect).toHaveBeenCalledWith('SELL');
  });
});
