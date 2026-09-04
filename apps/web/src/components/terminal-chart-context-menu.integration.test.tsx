/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chartMocks = vi.hoisted(() => ({
  createChart:
    vi.fn<(container: unknown, options: Record<string, unknown>) => unknown>(),
}));

const chartApi = {
  addSeries: vi.fn(),
  applyOptions: vi.fn(),
  remove: vi.fn(),
  subscribeClick: vi.fn(),
  timeScale: vi.fn(),
  unsubscribeClick: vi.fn(),
};

const candleSeries = {
  applyOptions: vi.fn(),
  coordinateToPrice: vi.fn(() => 1.08432),
  priceToCoordinate: vi.fn((): number | null => null),
  setData: vi.fn(),
};

const requestChartFullscreen = vi.fn();
const onOrderSideSelect = vi.fn();
const lineSeries: Array<{
  applyOptions: ReturnType<typeof vi.fn>;
  setData: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'candlestick',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  createChart: chartMocks.createChart,
  createSeriesMarkers: vi.fn(),
  LineSeries: 'line',
}));

import { TerminalChart } from './terminal-chart';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  chartApi.addSeries.mockReset();
  chartMocks.createChart.mockReset();
  chartApi.applyOptions.mockReset();
  chartApi.remove.mockReset();
  chartApi.subscribeClick.mockReset();
  chartApi.timeScale.mockReset();
  chartApi.unsubscribeClick.mockReset();
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
  overlayCoordinates = false,
}: {
  candleCount?: number;
  futureSpace?: boolean;
  overlayCoordinates?: boolean;
} = {}) {
  lineSeries.length = 0;
  chartMocks.createChart.mockReturnValue(chartApi);
  chartApi.addSeries.mockImplementation((seriesType) => {
    if (seriesType === 'candlestick') return candleSeries;
    const series = { applyOptions: vi.fn(), setData: vi.fn() };
    lineSeries.push(series);
    return series;
  });
  candleSeries.priceToCoordinate.mockReturnValue(
    futureSpace || overlayCoordinates ? 120 : null,
  );
  const timeScale = {
    coordinateToLogical: () => (futureSpace ? 4 : 0),
    coordinateToTime: () => (futureSpace ? null : 1_723_967_200),
    fitContent: vi.fn(),
    logicalToCoordinate: (logical: number) =>
      futureSpace ? logical * 40 : null,
    scrollToRealTime: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn(),
    timeToIndex: () => 0,
    timeToCoordinate: vi.fn((_time: unknown): number | null =>
      overlayCoordinates ? 30 : null,
    ),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };
  chartApi.timeScale.mockReturnValue(timeScale);

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

  return { timeScale };
}

describe('terminal chart context-menu integration', () => {
  it('uses a free crosshair instead of OHLC magnet mode', () => {
    renderChart();

    expect(chartMocks.createChart.mock.calls[0]?.[1]).toMatchObject({
      crosshair: { mode: 0 },
    });
  });

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

  it('reprojects saved drawings whenever the chart viewport moves', async () => {
    class TestResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      disconnect() {}

      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const flushAnimationFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    };
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => {
      frames.delete(frame);
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 600, 320),
    );
    window.localStorage.setItem(
      'profitopath:terminal-drawings:v1:account-1:EURUSD',
      JSON.stringify([
        {
          first: { price: 1.08432, time: 1_723_636_800 },
          id: 'saved-ray',
          kind: 'HORIZONTAL_RAY',
          version: 1,
        },
      ]),
    );

    const { timeScale } = renderChart({ overlayCoordinates: true });
    const overlay = await screen.findByLabelText('Chart drawing annotations');
    const ray = overlay.querySelector('.chart-drawing-line');

    expect(ray?.getAttribute('x1')).toBe('30');
    expect(ray?.getAttribute('y1')).toBe('120');

    await act(async () => {
      flushAnimationFrames();
    });

    timeScale.timeToCoordinate.mockReturnValue(170);
    const onVisibleRangeChange =
      timeScale.subscribeVisibleLogicalRangeChange.mock.calls[0]?.[0];
    expect(onVisibleRangeChange).toBeTypeOf('function');

    await act(async () => {
      await onVisibleRangeChange({ from: 20, to: 80 });
      flushAnimationFrames();
    });

    expect(ray?.getAttribute('x1')).toBe('170');

    candleSeries.priceToCoordinate.mockReturnValue(210);
    fireEvent.pointerMove(
      screen.getByLabelText('EURUSD interactive chart canvas'),
      { buttons: 1, clientX: 180, clientY: 140 },
    );

    await act(async () => {
      flushAnimationFrames();
    });

    expect(ray?.getAttribute('y1')).toBe('210');
  });

  it('locks a measurement on its second click instead of clearing it on pointer release', () => {
    renderChart({ overlayCoordinates: true });
    candleSeries.coordinateToPrice
      .mockReturnValueOnce(1.1)
      .mockReturnValueOnce(1.106)
      .mockReturnValueOnce(1.105)
      .mockReturnValue(1.099);

    fireEvent.click(
      screen.getByRole('button', { name: 'Measure price and time range' }),
    );
    const canvas = screen.getByLabelText('EURUSD interactive chart canvas');

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 120,
      clientY: 160,
      pointerId: 1,
    });
    fireEvent.pointerMove(canvas, {
      clientX: 240,
      clientY: 220,
      pointerId: 1,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 220,
      clientY: 210,
      pointerId: 2,
    });

    expect(document.querySelector('.chart-measurement')?.textContent).toContain(
      '+0.00500 · 50.0 pips',
    );
    expect(
      screen.getByText('Measurement locked · Select Measure to replace'),
    ).toBeTruthy();

    fireEvent.pointerMove(canvas, {
      clientX: 320,
      clientY: 260,
      pointerId: 2,
    });

    expect(document.querySelector('.chart-measurement')?.textContent).toContain(
      '+0.00500 · 50.0 pips',
    );
  });

  it('requests browser fullscreen for the chart panel only', () => {
    renderChart();

    fireEvent.click(screen.getByRole('button', { name: 'Chart full screen' }));

    expect(requestChartFullscreen).toHaveBeenCalledTimes(1);
  });

  it('lists multiple applied studies with independent parameters and latest values in the chart pane', () => {
    renderChart({ candleCount: 50 });

    fireEvent.click(screen.getByRole('button', { name: 'Studies' }));
    fireEvent.click(screen.getByRole('button', { name: 'SMA' }));
    fireEvent.click(screen.getByRole('button', { name: 'SMA' }));
    fireEvent.change(screen.getByLabelText('Simple moving average 2 length'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    const legend = screen.getByLabelText('Active chart studies');
    expect(within(legend).getByText('SMA 20 · 1')).toBeTruthy();
    expect(within(legend).getByText('SMA 50 · 2')).toBeTruthy();
    expect(within(legend).getAllByText('1.08432')).toHaveLength(2);
  });

  it('selects studies from the chart legend or plotted line and opens settings for the selected study', () => {
    renderChart({ candleCount: 50 });

    fireEvent.click(screen.getByRole('button', { name: 'Studies' }));
    fireEvent.click(screen.getByRole('button', { name: 'SMA' }));
    fireEvent.click(screen.getByRole('button', { name: 'EMA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    const sma = screen.getByRole('button', { name: /^Select SMA 20/ });
    const ema = screen.getByRole('button', { name: /^Select EMA 50/ });
    expect(sma).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(ema);
    expect(ema).toHaveProperty('ariaPressed', 'true');

    const onChartClick = chartApi.subscribeClick.mock.calls[0]?.[0];
    act(() => onChartClick({ hoveredInfo: { series: lineSeries[0] } }));
    expect(sma).toHaveProperty('ariaPressed', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Open settings for SMA 20' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Indicator settings' }),
    ).toBeTruthy();
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
