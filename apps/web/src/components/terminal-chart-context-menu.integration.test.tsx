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
});

function renderChart({ futureSpace = false }: { futureSpace?: boolean } = {}) {
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
      initialCandles: [
        {
          close: '1.08432',
          high: '1.08500',
          isFinal: true,
          low: '1.08300',
          open: '1.08400',
          openTime: '2024-08-14T12:00:00.000Z',
        },
      ],
      initialSymbol: 'EURUSD',
      liveCandle: null,
      markers: [],
      onProtectionDrop: vi.fn(),
      positions: [],
      protectionMessage: '',
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
});
