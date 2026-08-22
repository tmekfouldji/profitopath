'use client';

import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface TerminalChartCandle {
  close: string;
  high: string;
  isFinal: boolean;
  low: string;
  open: string;
  openTime: string;
}

export interface TerminalChartMarker {
  color: string;
  position: 'aboveBar' | 'belowBar';
  shape: 'arrowDown' | 'arrowUp';
  text: string;
  time: string;
}

const timeframeSeconds = {
  '1h': 3_600,
  '1m': 60,
  '5m': 300,
  '15m': 900,
} as const;

type ChartTimeframe = keyof typeof timeframeSeconds;

function chartTime(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1_000) as UTCTimestamp;
}

function chartData(candles: readonly TerminalChartCandle[]) {
  return candles.map((candle) => ({
    close: Number(candle.close),
    high: Number(candle.high),
    low: Number(candle.low),
    open: Number(candle.open),
    time: chartTime(candle.openTime),
  }));
}

function mergeCandles(
  current: readonly TerminalChartCandle[],
  incoming: readonly TerminalChartCandle[],
): TerminalChartCandle[] {
  const values = new Map(
    current.map((candle) => [candle.openTime, candle] as const),
  );
  for (const candle of incoming) {
    values.set(candle.openTime, candle);
  }
  return [...values.values()].sort((left, right) =>
    left.openTime.localeCompare(right.openTime),
  );
}

export function TerminalChart({
  accountId,
  historyAnchor,
  initialCandles,
  initialSymbol,
  liveCandle,
  markers,
  symbol,
}: {
  accountId: string;
  historyAnchor: string;
  initialCandles: TerminalChartCandle[];
  initialSymbol: string;
  liveCandle: TerminalChartCandle | null;
  markers: TerminalChartMarker[];
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef(initialCandles);
  const historyStateRef = useRef<'IDLE' | 'LOADING' | 'EXHAUSTED'>('IDLE');
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const timeframeRef = useRef<ChartTimeframe>('1m');
  const loadingOlderRef = useRef(false);
  const [candles, setCandles] = useState(initialCandles);
  const [historyState, setHistoryState] = useState<
    'IDLE' | 'LOADING' | 'EXHAUSTED'
  >('IDLE');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1m');

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  const loadRange = useCallback(
    async (input: {
      append: boolean;
      from: Date;
      timeframe: ChartTimeframe;
      to: Date;
    }) => {
      const query = new URLSearchParams({
        accountId,
        from: input.from.toISOString(),
        limit: '500',
        symbol,
        timeframe: input.timeframe,
        to: input.to.toISOString(),
      });
      const response = await fetch(`/api/market-data/candles?${query}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Candle history is unavailable');
      }
      const payload = (await response.json()) as {
        candles: TerminalChartCandle[];
      };
      setCandles((current) =>
        input.append ? mergeCandles(current, payload.candles) : payload.candles,
      );
      return payload.candles.length;
    },
    [accountId, symbol],
  );

  useEffect(() => {
    setTimeframe('1m');
    setHistoryState('LOADING');
    if (symbol === initialSymbol) {
      setCandles(initialCandles);
      setHistoryState('IDLE');
      return;
    }
    const to = new Date(historyAnchor);
    const from = new Date(to.getTime() - 500 * timeframeSeconds['1m'] * 1_000);
    void loadRange({ append: false, from, timeframe: '1m', to })
      .then((count) => {
        setHistoryState(count === 0 ? 'EXHAUSTED' : 'IDLE');
        chartRef.current?.timeScale().fitContent();
      })
      .catch(() => {
        setCandles([]);
        setHistoryState('EXHAUSTED');
      });
  }, [historyAnchor, initialCandles, initialSymbol, loadRange, symbol]);

  useEffect(() => {
    if (liveCandle !== null && timeframe === '1m') {
      setCandles((current) => mergeCandles(current, [liveCandle]));
    }
  }, [liveCandle, timeframe]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const chart = createChart(container, {
      autoSize: true,
      crosshair: {
        horzLine: { color: '#36505a', labelBackgroundColor: '#153f43' },
        vertLine: { color: '#36505a', labelBackgroundColor: '#153f43' },
      },
      grid: {
        horzLines: { color: '#18323d' },
        vertLines: { color: '#18323d' },
      },
      layout: {
        attributionLogo: false,
        background: { color: '#0b202b', type: ColorType.Solid },
        textColor: '#8da5ab',
      },
      rightPriceScale: { borderColor: '#29434d' },
      timeScale: {
        borderColor: '#29434d',
        rightOffset: 5,
        timeVisible: true,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      borderDownColor: '#ff8065',
      borderUpColor: '#56d6c9',
      downColor: '#ff8065',
      priceFormat: { minMove: 0.00001, precision: 5, type: 'price' },
      wickDownColor: '#ff9a84',
      wickUpColor: '#7ce4da',
      upColor: '#56d6c9',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const markerData: SeriesMarker<Time>[] = markers.map((marker) => ({
      ...marker,
      time: chartTime(marker.time),
    }));
    createSeriesMarkers(series, markerData);
    chart.timeScale().fitContent();
    const onRange = async (range: { from: number; to: number } | null) => {
      if (
        range === null ||
        range.from > 8 ||
        loadingOlderRef.current ||
        historyStateRef.current === 'EXHAUSTED'
      ) {
        return;
      }
      const earliest = candlesRef.current[0];
      if (earliest === undefined) {
        return;
      }
      loadingOlderRef.current = true;
      setHistoryState('LOADING');
      try {
        const to = new Date(earliest.openTime);
        const activeTimeframe = timeframeRef.current;
        const seconds = timeframeSeconds[activeTimeframe];
        const from = new Date(to.getTime() - seconds * 500 * 1_000);
        const count = await loadRange({
          append: true,
          from,
          timeframe: activeTimeframe,
          to,
        });
        setHistoryState(count === 0 ? 'EXHAUSTED' : 'IDLE');
      } catch {
        setHistoryState('IDLE');
      } finally {
        loadingOlderRef.current = false;
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [loadRange, markers]);

  useEffect(() => {
    seriesRef.current?.setData(chartData(candles));
  }, [candles]);

  async function selectTimeframe(next: ChartTimeframe) {
    setTimeframe(next);
    setHistoryState('LOADING');
    const latest = candlesRef.current.at(-1);
    const to =
      latest === undefined
        ? new Date()
        : new Date(
            new Date(latest.openTime).getTime() +
              timeframeSeconds[timeframeRef.current] * 1_000,
          );
    const from = new Date(to.getTime() - timeframeSeconds[next] * 240 * 1_000);
    try {
      const count = await loadRange({
        append: false,
        from,
        timeframe: next,
        to,
      });
      setHistoryState(count === 0 ? 'EXHAUSTED' : 'IDLE');
      chartRef.current?.timeScale().fitContent();
    } catch {
      setHistoryState('EXHAUSTED');
    }
  }

  return (
    <section className="terminal-chart-panel" aria-label={`${symbol} chart`}>
      <header className="chart-toolbar">
        <div>
          <span className="data-label">Market / {symbol}</span>
          <strong>
            {symbol.slice(0, 3)} / {symbol.slice(3)}
          </strong>
        </div>
        <div className="timeframe-switcher" aria-label="Chart timeframe">
          {(Object.keys(timeframeSeconds) as ChartTimeframe[]).map((option) => (
            <button
              aria-pressed={timeframe === option}
              className={timeframe === option ? 'is-active' : ''}
              key={option}
              onClick={() => void selectTimeframe(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </header>
      <div className="chart-stage" ref={containerRef} />
      <footer className="chart-footnote">
        <span>
          {historyState === 'LOADING'
            ? 'Loading older server history…'
            : 'Scroll left for older locally stored candles'}
        </span>
        <span>Mock data · UTC · server-built candles</span>
      </footer>
    </section>
  );
}
