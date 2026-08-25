'use client';

import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type Coordinate,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
} from './terminal-chart-studies';
import { TerminalChartIndicatorDialog } from './terminal-chart-indicator-dialog';
import {
  cloneChartIndicatorSettings,
  defaultChartIndicatorSettings,
  indicatorLabel,
  type ChartIndicatorId,
} from './terminal-chart-indicators';
import {
  parseTerminalChartDrawings,
  positionPlanStats,
  replaceTerminalChartDrawingPoint,
  translateTerminalChartDrawing,
  type TerminalChartDrawing,
  type TerminalChartDrawingKind,
  type TerminalChartDrawingPoint,
} from './terminal-chart-drawings';
import {
  futureDrawingLogicalPosition,
  futureDrawingTimeAtLogicalPosition,
} from './terminal-chart-future-space';
import {
  TerminalChartContextMenu,
  type TerminalChartCommandTool,
} from './terminal-chart-context-menu';

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

export interface TerminalChartPosition {
  averageEntryPrice: string;
  id: string;
  markPrice: string | null;
  priceScale: number;
  side: 'LONG' | 'SHORT';
  stopLossPrice: string | null;
  symbol: string;
  takeProfitPrice: string | null;
}

export interface TerminalChartQuote {
  ask: string | null;
  bid: string | null;
  status: 'LIVE' | 'MISSING';
  symbol: string;
}

const timeframeSeconds = {
  '1d': 86_400,
  '1h': 3_600,
  '1m': 60,
  '4h': 14_400,
  '5m': 300,
  '15m': 900,
} as const;

type ChartTimeframe = keyof typeof timeframeSeconds;
type Indicator = ChartIndicatorId;
type ChartTool = 'CURSOR' | 'MEASURE' | TerminalChartDrawingKind;
type ProtectionKind = 'STOP_LOSS' | 'TAKE_PROFIT';

const indicatorOrder: readonly Indicator[] = ['SMA_20', 'EMA_50', 'BOLLINGER'];
const futureChartMarginBars = 16;

interface ProtectionDrag {
  kind: ProtectionKind;
  pointerId: number;
  position: TerminalChartPosition;
  price: string;
}

interface ChartPoint extends TerminalChartDrawingPoint {
  x: number;
  y: number;
}

interface MeasureDrag {
  current: ChartPoint;
  pointerId: number;
  start: ChartPoint;
}

interface DrawingDraft {
  current: ChartPoint;
  pointerId: number;
  start: ChartPoint;
  tool: Exclude<ChartTool, 'CURSOR' | 'HORIZONTAL_RAY' | 'MEASURE'>;
}

interface DrawingEdit {
  drawing: TerminalChartDrawing;
  mode: 'FIRST' | 'MOVE' | 'SECOND' | 'THIRD';
  pointerId: number;
  start: ChartPoint;
}

interface ChartContextMenuState {
  point: ChartPoint;
  position: { x: number; y: number };
}

interface ChartStudyLegendItem {
  color: string;
  label: string;
  values: string[];
}

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

function priceText(value: number, priceScale: number): string {
  return value.toFixed(priceScale);
}

function protectionLabel(kind: ProtectionKind): string {
  return kind === 'STOP_LOSS' ? 'SL' : 'TP';
}

function drawingLabel(kind: TerminalChartDrawingKind): string {
  return {
    HORIZONTAL_RAY: 'Horizontal ray',
    LONG_POSITION: 'Long position plan',
    RECTANGLE: 'Rectangle zone',
    SHORT_POSITION: 'Short position plan',
    TRENDLINE: 'Trend line',
  }[kind];
}

function drawingStorageKey(accountId: string, symbol: string): string {
  return `profitopath:terminal-drawings:v1:${accountId}:${symbol}`;
}

function drawingId(): string {
  return crypto.randomUUID();
}

export function TerminalChart({
  accountId,
  canEditProtection,
  historyAnchor,
  initialCandles,
  initialSymbol,
  liveCandle,
  markers,
  onOrderSideSelect,
  onProtectionDrop,
  orderSide,
  positions,
  protectionMessage,
  quote,
  symbol,
}: {
  accountId: string;
  canEditProtection: boolean;
  historyAnchor: string;
  initialCandles: TerminalChartCandle[];
  initialSymbol: string;
  liveCandle: TerminalChartCandle | null;
  markers: TerminalChartMarker[];
  onOrderSideSelect(side: 'BUY' | 'SELL'): void;
  onProtectionDrop(input: {
    kind: ProtectionKind;
    position: TerminalChartPosition;
    price: string;
  }): void;
  orderSide: 'BUY' | 'SELL';
  positions: TerminalChartPosition[];
  protectionMessage: string;
  quote: TerminalChartQuote | undefined;
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef(initialCandles);
  const drawingDraftRef = useRef<DrawingDraft | null>(null);
  const drawingEditRef = useRef<DrawingEdit | null>(null);
  const historyStateRef = useRef<'IDLE' | 'LOADING' | 'EXHAUSTED'>('IDLE');
  const indicatorSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const chartPanelRef = useRef<HTMLElement>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeframeRef = useRef<ChartTimeframe>('1m');
  const loadingOlderRef = useRef(false);
  const [candles, setCandles] = useState(initialCandles);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [chartGeneration, setChartGeneration] = useState(0);
  const [quoteButtonsVisible, setQuoteButtonsVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<ChartContextMenuState | null>(
    null,
  );
  const [drag, setDrag] = useState<ProtectionDrag | null>(null);
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft | null>(null);
  const [drawings, setDrawings] = useState<TerminalChartDrawing[]>([]);
  const [drawingsScope, setDrawingsScope] = useState<string | null>(null);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [historyState, setHistoryState] = useState<
    'IDLE' | 'LOADING' | 'EXHAUSTED'
  >('IDLE');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorSettings, setIndicatorSettings] = useState(() =>
    cloneChartIndicatorSettings(defaultChartIndicatorSettings),
  );
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [keepDrawing, setKeepDrawing] = useState(false);
  const [lastPriceVisible, setLastPriceVisible] = useState(true);
  const [measure, setMeasure] = useState<MeasureDrag | null>(null);
  const [overlayRevision, setOverlayRevision] = useState(0);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [positionLevelsVisible, setPositionLevelsVisible] = useState(true);
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1m');
  const [tool, setTool] = useState<ChartTool>('CURSOR');

  const activePositions = useMemo(
    () => positions.filter((position) => position.symbol === symbol),
    [positions, symbol],
  );
  const priceScale = activePositions[0]?.priceScale ?? 5;
  const studyCandles = useMemo(
    () =>
      chartData(candles).map((candle) => ({
        close: candle.close,
        time: Number(candle.time),
      })),
    [candles],
  );
  const studyLegend = useMemo(() => {
    const items: ChartStudyLegendItem[] = [];
    for (const indicator of indicatorOrder) {
      if (!indicators.includes(indicator)) continue;
      const label = indicatorLabel(indicator, indicatorSettings);
      const color = indicatorSettings[indicator].color;
      if (indicator === 'SMA_20') {
        const value = simpleMovingAverage(
          studyCandles,
          indicatorSettings.SMA_20.period,
        ).at(-1);
        items.push({
          color,
          label,
          values:
            value === undefined ? [] : [priceText(value.close, priceScale)],
        });
        continue;
      }
      if (indicator === 'EMA_50') {
        const value = exponentialMovingAverage(
          studyCandles,
          indicatorSettings.EMA_50.period,
        ).at(-1);
        items.push({
          color,
          label,
          values:
            value === undefined ? [] : [priceText(value.close, priceScale)],
        });
        continue;
      }
      const values = bollingerBands(
        studyCandles,
        indicatorSettings.BOLLINGER.period,
        indicatorSettings.BOLLINGER.deviations,
      ).at(-1);
      items.push({
        color,
        label,
        values:
          values === undefined
            ? []
            : [values.upper, values.middle, values.lower].map((value) =>
                priceText(value, priceScale),
              ),
      });
    }
    return items;
  }, [indicatorSettings, indicators, priceScale, studyCandles]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOverlayRevision((value) => value + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [activePositions, candles, chartGeneration, drag, drawings, drawingDraft]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const bounds = stage.getBoundingClientRect();
      setStageSize({ height: bounds.height, width: bounds.width });
      setOverlayRevision((value) => value + 1);
    });
    observer.observe(stage);
    const bounds = stage.getBoundingClientRect();
    setStageSize({ height: bounds.height, width: bounds.width });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function syncChartFullscreen() {
      setChartFullscreen(document.fullscreenElement === chartPanelRef.current);
    }
    document.addEventListener('fullscreenchange', syncChartFullscreen);
    return () =>
      document.removeEventListener('fullscreenchange', syncChartFullscreen);
  }, []);

  useEffect(() => {
    const storageKey = drawingStorageKey(accountId, symbol);
    try {
      setDrawings(
        parseTerminalChartDrawings(window.localStorage.getItem(storageKey)),
      );
    } catch {
      setDrawings([]);
    }
    setDrawingsScope(storageKey);
    setSelectedDrawingId(null);
    drawingDraftRef.current = null;
    drawingEditRef.current = null;
    setContextMenu(null);
    setDrawingDraft(null);
  }, [accountId, symbol]);

  useEffect(() => {
    const storageKey = drawingStorageKey(accountId, symbol);
    if (drawingsScope !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch {
      // Browser drawing annotations are optional and never part of the trading ledger.
    }
  }, [accountId, drawings, drawingsScope, symbol]);

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
    if (container === null) return;
    const chart = createChart(container, {
      autoSize: true,
      crosshair: {
        horzLine: { color: '#40577b', labelBackgroundColor: '#182b50' },
        vertLine: { color: '#40577b', labelBackgroundColor: '#182b50' },
      },
      grid: {
        horzLines: { color: '#1c2d47' },
        vertLines: { color: '#1c2d47' },
      },
      layout: {
        attributionLogo: false,
        background: { color: '#0e1a2d', type: ColorType.Solid },
        textColor: '#9aaac3',
      },
      rightPriceScale: { borderColor: '#2a3c59' },
      timeScale: {
        borderColor: '#2a3c59',
        rightOffset: futureChartMarginBars,
        timeVisible: true,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      borderDownColor: '#ff806d',
      borderUpColor: '#82a8ff',
      downColor: '#ff806d',
      priceFormat: { minMove: 0.00001, precision: 5, type: 'price' },
      wickDownColor: '#ffae9f',
      wickUpColor: '#aec3ff',
      upColor: '#82a8ff',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const markerData: SeriesMarker<Time>[] = markers.map((marker) => ({
      ...marker,
      time: chartTime(marker.time),
    }));
    createSeriesMarkers(series, markerData);
    chart.timeScale().fitContent();
    setChartGeneration((value) => value + 1);
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
      if (earliest === undefined) return;
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

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        horzLines: { color: '#1c2d47', visible: gridVisible },
        vertLines: { color: '#1c2d47', visible: gridVisible },
      },
    });
  }, [chartGeneration, gridVisible]);

  useEffect(() => {
    seriesRef.current?.applyOptions({
      lastValueVisible: lastPriceVisible,
      priceLineVisible: lastPriceVisible,
    });
  }, [chartGeneration, lastPriceVisible]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) return;
    const activeChart = chart;
    for (const series of indicatorSeriesRef.current) {
      activeChart.removeSeries(series);
    }
    indicatorSeriesRef.current = [];
    function addStudy(
      color: string,
      values: { time: number; value: number }[],
    ) {
      const series = activeChart.addSeries(LineSeries, {
        color,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        lineWidth: 1,
        priceLineVisible: false,
      });
      series.setData(
        values.map((value) => ({
          time: value.time as UTCTimestamp,
          value: value.value,
        })),
      );
      indicatorSeriesRef.current.push(series);
    }
    if (indicators.includes('SMA_20')) {
      addStudy(
        indicatorSettings.SMA_20.color,
        simpleMovingAverage(studyCandles, indicatorSettings.SMA_20.period).map(
          (value) => ({
            time: value.time,
            value: value.close,
          }),
        ),
      );
    }
    if (indicators.includes('EMA_50')) {
      addStudy(
        indicatorSettings.EMA_50.color,
        exponentialMovingAverage(
          studyCandles,
          indicatorSettings.EMA_50.period,
        ).map((value) => ({
          time: value.time,
          value: value.close,
        })),
      );
    }
    if (indicators.includes('BOLLINGER')) {
      const bands = bollingerBands(
        studyCandles,
        indicatorSettings.BOLLINGER.period,
        indicatorSettings.BOLLINGER.deviations,
      );
      addStudy(
        indicatorSettings.BOLLINGER.color,
        bands.map((value) => ({ time: value.time, value: value.upper })),
      );
      addStudy(
        indicatorSettings.BOLLINGER.color,
        bands.map((value) => ({ time: value.time, value: value.middle })),
      );
      addStudy(
        indicatorSettings.BOLLINGER.color,
        bands.map((value) => ({ time: value.time, value: value.lower })),
      );
    }
  }, [chartGeneration, indicatorSettings, indicators, studyCandles]);

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

  function chartPoint(event: {
    clientX: number;
    clientY: number;
  }): ChartPoint | null {
    const stage = stageRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (stage === null || series === null || chart === null) return null;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const price = series.coordinateToPrice(y as Coordinate);
    const timeScale = chart.timeScale();
    const chartTimeAtCoordinate = timeScale.coordinateToTime(x as Coordinate);
    const futureTime = futureTimeAtCoordinate(
      timeScale.coordinateToLogical(x as Coordinate),
    );
    const time =
      futureTime ??
      (typeof chartTimeAtCoordinate === 'number'
        ? chartTimeAtCoordinate
        : null);
    if (price === null || time === null) return null;
    return { price, time, x, y };
  }

  function latestLogicalAnchor() {
    const latest = candlesRef.current.at(-1);
    const chart = chartRef.current;
    if (latest === undefined || chart === null) return null;
    const lastTime = chartTime(latest.openTime);
    const lastLogical = chart.timeScale().timeToIndex(lastTime);
    if (lastLogical === null) return null;
    return { lastLogical, lastTime };
  }

  function futureTimeAtCoordinate(logical: number | null): number | null {
    const anchor = latestLogicalAnchor();
    if (anchor === null) return null;
    return futureDrawingTimeAtLogicalPosition({
      ...anchor,
      logical,
      secondsPerBar: timeframeSeconds[timeframeRef.current],
    });
  }

  function selectDrawingTool(next: TerminalChartCommandTool) {
    setSelectedDrawingId(null);
    setTool(next);
  }

  async function toggleChartFullscreen() {
    const panel = chartPanelRef.current;
    if (panel === null) return;
    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch {
      setChartFullscreen(false);
    }
  }

  function addHorizontalRay(point: ChartPoint) {
    const drawing: TerminalChartDrawing = {
      first: { price: point.price, time: point.time },
      id: drawingId(),
      kind: 'HORIZONTAL_RAY',
      version: 1,
    };
    setDrawings((current) => [...current, drawing]);
    setSelectedDrawingId(drawing.id);
    if (!keepDrawing) setTool('CURSOR');
  }

  function removeSelectedDrawing() {
    setDrawings((current) =>
      current.filter((drawing) => drawing.id !== selectedDrawingId),
    );
    setSelectedDrawingId(null);
  }

  function clearDrawings() {
    setDrawings([]);
    setSelectedDrawingId(null);
  }

  function openContextMenu(point: ChartPoint) {
    const stage = stageRef.current;
    if (stage === null) return;
    const bounds = stage.getBoundingClientRect();
    const horizontalMargin = 8;
    const menuWidth = 220;
    const menuHeight = 320;
    setContextMenu({
      point,
      position: {
        x: Math.max(
          horizontalMargin,
          Math.min(
            point.x + 8,
            Math.max(horizontalMargin, bounds.width - menuWidth),
          ),
        ),
        y: Math.max(
          horizontalMargin,
          Math.min(
            point.y + 8,
            Math.max(horizontalMargin, bounds.height - menuHeight),
          ),
        ),
      },
    });
  }

  function openKeyboardContextMenu() {
    const stage = stageRef.current;
    if (stage === null) return;
    const bounds = stage.getBoundingClientRect();
    const point = chartPoint({
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    });
    if (point !== null) openContextMenu(point);
  }

  function setDraft(next: DrawingDraft | null) {
    drawingDraftRef.current = next;
    setDrawingDraft(next);
  }

  function createDrawing(
    activeTool: DrawingDraft['tool'],
    start: ChartPoint,
    current: ChartPoint,
    id = drawingId(),
  ): TerminalChartDrawing {
    if (activeTool === 'LONG_POSITION' || activeTool === 'SHORT_POSITION') {
      const distance = Math.abs(current.price - start.price);
      const target =
        activeTool === 'LONG_POSITION'
          ? start.price + distance
          : start.price - distance;
      const stop =
        activeTool === 'LONG_POSITION'
          ? start.price - distance
          : start.price + distance;
      return {
        first: { price: start.price, time: start.time },
        id,
        kind: activeTool,
        second: { price: target, time: current.time },
        third: { price: stop, time: current.time },
        version: 1,
      };
    }
    return {
      first: { price: start.price, time: start.time },
      id,
      kind: activeTool,
      second: { price: current.price, time: current.time },
      version: 1,
    };
  }

  function handleStagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (contextMenu !== null && event.button === 0) {
      setContextMenu(null);
    }
    if (event.button !== 0 || tool === 'CURSOR') return;
    const point = chartPoint(event);
    if (point === null) return;
    event.preventDefault();
    if (tool === 'HORIZONTAL_RAY') {
      addHorizontalRay(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'MEASURE') {
      setMeasure({ current: point, pointerId: event.pointerId, start: point });
      return;
    }
    setDraft({
      current: point,
      pointerId: event.pointerId,
      start: point,
      tool,
    });
  }

  function handleStagePointerMove(event: PointerEvent<HTMLDivElement>) {
    const point = chartPoint(event);
    if (point === null) return;
    const edit = drawingEditRef.current;
    if (edit?.pointerId === event.pointerId) {
      const next =
        edit.mode === 'MOVE'
          ? translateTerminalChartDrawing(edit.drawing, {
              price: point.price - edit.start.price,
              time: point.time - edit.start.time,
            })
          : replaceTerminalChartDrawingPoint(
              edit.drawing,
              edit.mode,
              edit.drawing.kind === 'HORIZONTAL_RAY'
                ? { price: point.price, time: edit.drawing.first.time }
                : { price: point.price, time: point.time },
            );
      setDrawings((current) =>
        current.map((drawing) => (drawing.id === next.id ? next : drawing)),
      );
      return;
    }
    const draft = drawingDraftRef.current;
    if (draft?.pointerId === event.pointerId) {
      setDraft({ ...draft, current: point });
      return;
    }
    if (measure?.pointerId === event.pointerId) {
      setMeasure((current) =>
        current === null ? current : { ...current, current: point },
      );
    }
  }

  function handleStagePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drawingEditRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      drawingEditRef.current = null;
      return;
    }
    const draft = drawingDraftRef.current;
    if (draft?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      const current = chartPoint(event) ?? draft.current;
      if (
        Math.abs(current.x - draft.start.x) > 3 ||
        Math.abs(current.y - draft.start.y) > 3
      ) {
        const drawing = createDrawing(draft.tool, draft.start, current);
        setDrawings((drawings) => [...drawings, drawing]);
        setSelectedDrawingId(drawing.id);
      }
      setDraft(null);
      if (!keepDrawing) setTool('CURSOR');
      return;
    }
    if (measure?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!keepDrawing) setTool('CURSOR');
  }

  function beginDrawingEdit(
    event: PointerEvent<SVGElement>,
    drawing: TerminalChartDrawing,
    mode: DrawingEdit['mode'],
  ) {
    if (event.button !== 0 || tool !== 'CURSOR') return;
    const point = chartPoint(event);
    if (point === null) return;
    event.preventDefault();
    event.stopPropagation();
    stageRef.current?.setPointerCapture(event.pointerId);
    drawingEditRef.current = {
      drawing,
      mode,
      pointerId: event.pointerId,
      start: point,
    };
    setSelectedDrawingId(drawing.id);
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key === 'ContextMenu' ||
      (event.shiftKey && event.key === 'F10')
    ) {
      event.preventDefault();
      openKeyboardContextMenu();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (contextMenu !== null) {
        setContextMenu(null);
        return;
      }
      drawingEditRef.current = null;
      setDraft(null);
      setMeasure(null);
      setSelectedDrawingId(null);
      setTool('CURSOR');
      return;
    }
    if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      selectedDrawingId !== null
    ) {
      event.preventDefault();
      setDrawings((current) =>
        current.filter((drawing) => drawing.id !== selectedDrawingId),
      );
      setSelectedDrawingId(null);
    }
  }

  function handleProtectionPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    position: TerminalChartPosition,
    kind: ProtectionKind,
    startingPrice: string,
  ) {
    if (!canEditProtection || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      kind,
      pointerId: event.pointerId,
      position,
      price: startingPrice,
    });
  }

  function handleProtectionPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (drag?.pointerId !== event.pointerId) return;
    const stage = stageRef.current;
    const series = seriesRef.current;
    if (stage === null || series === null) return;
    const bounds = stage.getBoundingClientRect();
    const next = series.coordinateToPrice(
      (event.clientY - bounds.top) as Coordinate,
    );
    if (next === null) return;
    setDrag((current) =>
      current === null
        ? current
        : {
            ...current,
            price: priceText(next, current.position.priceScale),
          },
    );
  }

  function handleProtectionPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (drag?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onProtectionDrop({
      kind: drag.kind,
      position: drag.position,
      price: drag.price,
    });
    setDrag(null);
  }

  function overlayTop(price: string): number | null {
    void overlayRevision;
    const coordinate = seriesRef.current?.priceToCoordinate(Number(price));
    return coordinate === null || coordinate === undefined ? null : coordinate;
  }

  function overlayPoint(
    point: TerminalChartDrawingPoint,
  ): { x: number; y: number } | null {
    void overlayRevision;
    const chart = chartRef.current;
    const timeScale = chart?.timeScale();
    const directX = timeScale?.timeToCoordinate(point.time as Time);
    const anchor = latestLogicalAnchor();
    const futureLogical =
      anchor === null
        ? null
        : futureDrawingLogicalPosition({
            ...anchor,
            secondsPerBar: timeframeSeconds[timeframeRef.current],
            time: point.time,
          });
    const x =
      directX ??
      (futureLogical === null || timeScale === undefined
        ? null
        : timeScale.logicalToCoordinate(futureLogical as Logical));
    const y = seriesRef.current?.priceToCoordinate(point.price);
    return x === null || x === undefined || y === null || y === undefined
      ? null
      : { x, y };
  }

  function drawingHandles(
    drawing: TerminalChartDrawing,
    points: Array<{
      mode: Exclude<DrawingEdit['mode'], 'MOVE'>;
      point: { x: number; y: number };
    }>,
    preview: boolean,
  ) {
    if (preview || selectedDrawingId !== drawing.id) return null;
    return points.map(({ mode, point }) => (
      <circle
        className="chart-drawing-handle"
        cx={point.x}
        cy={point.y}
        key={mode}
        onPointerDown={(event) => beginDrawingEdit(event, drawing, mode)}
        r="4"
      />
    ));
  }

  function renderDrawing(drawing: TerminalChartDrawing, preview = false) {
    const first = overlayPoint(drawing.first);
    if (first === null) return null;
    const selected = !preview && selectedDrawingId === drawing.id;
    const className = `chart-drawing is-${drawing.kind.toLowerCase()} ${
      selected ? 'is-selected' : ''
    } ${preview ? 'is-preview' : ''}`;
    const beginMove = preview
      ? undefined
      : (event: PointerEvent<SVGElement>) =>
          beginDrawingEdit(event, drawing, 'MOVE');

    if (drawing.kind === 'HORIZONTAL_RAY') {
      return (
        <g className={className} key={drawing.id}>
          <line
            className="chart-drawing-line"
            x1={first.x}
            x2={stageSize.width}
            y1={first.y}
            y2={first.y}
          />
          <line
            className="chart-drawing-hit-line"
            onPointerDown={beginMove}
            x1={first.x}
            x2={stageSize.width}
            y1={first.y}
            y2={first.y}
          />
          <text className="chart-drawing-label" x={first.x + 8} y={first.y - 7}>
            {priceText(drawing.first.price, priceScale)}
          </text>
          {drawingHandles(drawing, [{ mode: 'FIRST', point: first }], preview)}
        </g>
      );
    }

    if (drawing.second === undefined) return null;
    const second = overlayPoint(drawing.second);
    if (second === null) return null;

    if (drawing.kind === 'TRENDLINE') {
      return (
        <g className={className} key={drawing.id}>
          <line
            className="chart-drawing-line"
            x1={first.x}
            x2={second.x}
            y1={first.y}
            y2={second.y}
          />
          <line
            className="chart-drawing-hit-line"
            onPointerDown={beginMove}
            x1={first.x}
            x2={second.x}
            y1={first.y}
            y2={second.y}
          />
          {drawingHandles(
            drawing,
            [
              { mode: 'FIRST', point: first },
              { mode: 'SECOND', point: second },
            ],
            preview,
          )}
        </g>
      );
    }

    if (drawing.kind === 'RECTANGLE') {
      const left = Math.min(first.x, second.x);
      const top = Math.min(first.y, second.y);
      const width = Math.abs(first.x - second.x);
      const height = Math.abs(first.y - second.y);
      return (
        <g className={className} key={drawing.id}>
          <rect
            className="chart-drawing-zone"
            height={Math.max(1, height)}
            width={Math.max(1, width)}
            x={left}
            y={top}
          />
          <rect
            className="chart-drawing-hit-area"
            height={Math.max(12, height)}
            onPointerDown={beginMove}
            width={Math.max(12, width)}
            x={left}
            y={top}
          />
          {drawingHandles(
            drawing,
            [
              { mode: 'FIRST', point: first },
              { mode: 'SECOND', point: second },
            ],
            preview,
          )}
        </g>
      );
    }

    if (drawing.third === undefined) return null;
    const third = overlayPoint(drawing.third);
    if (third === null) return null;
    const left = Math.min(first.x, second.x, third.x);
    const right = Math.max(first.x + 50, second.x, third.x);
    const stats = positionPlanStats(drawing, priceScale);
    const targetTop = Math.min(first.y, second.y);
    const targetHeight = Math.abs(first.y - second.y);
    const stopTop = Math.min(first.y, third.y);
    const stopHeight = Math.abs(first.y - third.y);
    return (
      <g className={className} key={drawing.id}>
        <rect
          className="chart-plan-target"
          height={Math.max(1, targetHeight)}
          width={Math.max(1, right - left)}
          x={left}
          y={targetTop}
        />
        <rect
          className="chart-plan-stop"
          height={Math.max(1, stopHeight)}
          width={Math.max(1, right - left)}
          x={left}
          y={stopTop}
        />
        <line
          className="chart-plan-entry"
          x1={left}
          x2={right}
          y1={first.y}
          y2={first.y}
        />
        <rect
          className="chart-drawing-hit-area"
          height={Math.max(
            12,
            Math.max(first.y, second.y, third.y) -
              Math.min(first.y, second.y, third.y),
          )}
          onPointerDown={beginMove}
          width={Math.max(12, right - left)}
          x={left}
          y={Math.min(first.y, second.y, third.y)}
        />
        <text className="chart-plan-label" x={left + 7} y={first.y - 7}>
          {drawing.kind === 'LONG_POSITION' ? 'LONG' : 'SHORT'} ·{' '}
          {stats === null
            ? 'SET TARGET / STOP'
            : `${stats.riskReward.toFixed(2)}R`}
        </text>
        {drawingHandles(
          drawing,
          [
            { mode: 'FIRST', point: first },
            { mode: 'SECOND', point: second },
            { mode: 'THIRD', point: third },
          ],
          preview,
        )}
      </g>
    );
  }

  const draftPreview =
    drawingDraft === null
      ? null
      : createDrawing(
          drawingDraft.tool,
          drawingDraft.start,
          drawingDraft.current,
          'draft',
        );

  const measureStyle =
    measure === null
      ? undefined
      : {
          height: `${Math.abs(measure.current.y - measure.start.y)}px`,
          left: `${Math.min(measure.current.x, measure.start.x)}px`,
          top: `${Math.min(measure.current.y, measure.start.y)}px`,
          width: `${Math.abs(measure.current.x - measure.start.x)}px`,
        };
  const measurePips =
    measure === null
      ? null
      : (measure.current.price - measure.start.price) *
        10 ** Math.max(0, priceScale - 1);

  return (
    <section
      aria-label={`${symbol} chart`}
      className={`terminal-chart-panel ${chartFullscreen ? 'is-chart-fullscreen' : ''}`}
      ref={chartPanelRef}
    >
      <header className="chart-toolbar">
        <div>
          <span className="data-label">Market / {symbol}</span>
          <strong>
            {symbol.slice(0, 3)} / {symbol.slice(3)}
          </strong>
        </div>
        <div className="chart-toolbar-controls">
          <div className="timeframe-switcher" aria-label="Chart timeframe">
            {(Object.keys(timeframeSeconds) as ChartTimeframe[]).map(
              (option) => (
                <button
                  aria-pressed={timeframe === option}
                  className={timeframe === option ? 'is-active' : ''}
                  key={option}
                  onClick={() => void selectTimeframe(option)}
                  type="button"
                >
                  {option}
                </button>
              ),
            )}
          </div>
          <div className="chart-indicators" aria-label="Chart indicators">
            <button
              aria-haspopup="dialog"
              className="chart-study-settings-trigger"
              onClick={() => setIndicatorSettingsOpen(true)}
              title="Open indicator settings"
              type="button"
            >
              <span aria-hidden="true">ƒx</span> Studies
              {indicators.length === 0 ? null : <b>{indicators.length}</b>}
            </button>
          </div>
          <button
            aria-pressed={chartFullscreen}
            className="chart-fullscreen-toggle"
            onClick={() => void toggleChartFullscreen()}
            title="Show only this chart in browser full screen"
            type="button"
          >
            {chartFullscreen ? 'Exit chart full screen' : 'Chart full screen'}
          </button>
        </div>
      </header>
      {indicatorSettingsOpen ? (
        <TerminalChartIndicatorDialog
          activeIndicators={indicators}
          onApply={({ activeIndicators, settings }) => {
            setIndicators(activeIndicators);
            setIndicatorSettings(settings);
            setIndicatorSettingsOpen(false);
          }}
          onClose={() => setIndicatorSettingsOpen(false)}
          settings={indicatorSettings}
        />
      ) : null}
      <div
        className={`chart-stage is-tool-${tool.toLowerCase()}`}
        aria-describedby="chart-tool-status"
        aria-label={`${symbol} interactive chart canvas`}
        onContextMenu={(event) => {
          event.preventDefault();
          const point = chartPoint(event);
          if (point !== null) openContextMenu(point);
        }}
        onKeyDown={handleStageKeyDown}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        ref={stageRef}
        tabIndex={0}
      >
        <div className="chart-canvas" ref={containerRef} />
        {studyLegend.length === 0 ? null : (
          <aside
            aria-label="Active chart studies"
            className="chart-study-legend"
          >
            {studyLegend.map((study) => (
              <div
                aria-label={`${study.label}${
                  study.values.length === 0
                    ? ', calculating'
                    : `, ${study.values.join(', ')}`
                }`}
                className="chart-study-legend-item"
                key={study.label}
              >
                <i
                  aria-hidden="true"
                  style={{ backgroundColor: study.color }}
                />
                <span>{study.label}</span>
                <b>
                  {study.values.length === 0 ? '—' : study.values.join(' ')}
                </b>
              </div>
            ))}
          </aside>
        )}
        {quoteButtonsVisible ? (
          <aside
            aria-label="Chart Buy/Sell selectors"
            className="chart-quote-buttons"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>Order side</span>
            <div>
              <button
                aria-label={`Select Sell / bid ${quote?.bid ?? 'unavailable'}`}
                aria-pressed={orderSide === 'SELL'}
                className="is-sell"
                disabled={quote?.status !== 'LIVE' || quote.bid === null}
                onClick={() => onOrderSideSelect('SELL')}
                title="Select Sell in the simulated order ticket"
                type="button"
              >
                <small>Sell</small>
                <strong>{quote?.bid ?? '—'}</strong>
              </button>
              <button
                aria-label={`Select Buy / ask ${quote?.ask ?? 'unavailable'}`}
                aria-pressed={orderSide === 'BUY'}
                className="is-buy"
                disabled={quote?.status !== 'LIVE' || quote.ask === null}
                onClick={() => onOrderSideSelect('BUY')}
                title="Select Buy in the simulated order ticket"
                type="button"
              >
                <small>Buy</small>
                <strong>{quote?.ask ?? '—'}</strong>
              </button>
            </div>
            <small className="chart-quote-buttons-note">
              Select side · submit from ticket
            </small>
          </aside>
        ) : null}
        <aside
          className="chart-drawing-toolbar"
          aria-label="Chart drawing tools"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label="Select and edit drawings"
            aria-pressed={tool === 'CURSOR'}
            onClick={() => selectDrawingTool('CURSOR')}
            title="Select and edit drawings (Escape)"
            type="button"
          >
            <span aria-hidden="true">⌖</span>
            <small>Select</small>
          </button>
          <button
            aria-label="Draw trend line"
            aria-pressed={tool === 'TRENDLINE'}
            onClick={() => selectDrawingTool('TRENDLINE')}
            title="Trend line"
            type="button"
          >
            <span aria-hidden="true">↗</span>
            <small>Trend</small>
          </button>
          <button
            aria-label="Draw horizontal ray"
            aria-pressed={tool === 'HORIZONTAL_RAY'}
            onClick={() => selectDrawingTool('HORIZONTAL_RAY')}
            title="Horizontal ray"
            type="button"
          >
            <span aria-hidden="true">—›</span>
            <small>Ray</small>
          </button>
          <button
            aria-label="Draw rectangle zone"
            aria-pressed={tool === 'RECTANGLE'}
            onClick={() => selectDrawingTool('RECTANGLE')}
            title="Rectangle zone"
            type="button"
          >
            <span aria-hidden="true">□</span>
            <small>Zone</small>
          </button>
          <button
            aria-label="Draw long position plan"
            aria-pressed={tool === 'LONG_POSITION'}
            onClick={() => selectDrawingTool('LONG_POSITION')}
            title="Long position risk/reward plan"
            type="button"
          >
            <span aria-hidden="true">L</span>
            <small>Long</small>
          </button>
          <button
            aria-label="Draw short position plan"
            aria-pressed={tool === 'SHORT_POSITION'}
            onClick={() => selectDrawingTool('SHORT_POSITION')}
            title="Short position risk/reward plan"
            type="button"
          >
            <span aria-hidden="true">S</span>
            <small>Short</small>
          </button>
          <button
            aria-label="Measure price and time range"
            aria-pressed={tool === 'MEASURE'}
            onClick={() => selectDrawingTool('MEASURE')}
            title="Measure price range"
            type="button"
          >
            <span aria-hidden="true">↕</span>
            <small>Measure</small>
          </button>
          <span className="chart-drawing-toolbar-rule" />
          <button
            aria-label="Delete selected drawing"
            disabled={selectedDrawingId === null}
            onClick={removeSelectedDrawing}
            title="Delete selected drawing (Delete)"
            type="button"
          >
            <span aria-hidden="true">×</span>
            <small>Delete</small>
          </button>
        </aside>
        {contextMenu === null ? null : (
          <TerminalChartContextMenu
            activeTool={tool}
            drawingsHidden={!drawingsVisible}
            gridVisible={gridVisible}
            keepDrawing={keepDrawing}
            lastPriceVisible={lastPriceVisible}
            onAddHorizontalRay={() => addHorizontalRay(contextMenu.point)}
            onClearDrawings={clearDrawings}
            onClose={() => setContextMenu(null)}
            onDeleteSelectedDrawing={removeSelectedDrawing}
            onFocusLatest={() =>
              chartRef.current?.timeScale().scrollToRealTime()
            }
            onResetView={() => chartRef.current?.timeScale().fitContent()}
            onSelectTool={selectDrawingTool}
            onToggleDrawings={() => setDrawingsVisible((current) => !current)}
            onToggleGrid={() => setGridVisible((current) => !current)}
            onToggleKeepDrawing={() => setKeepDrawing((current) => !current)}
            onToggleLastPrice={() => setLastPriceVisible((current) => !current)}
            onTogglePositionLevels={() =>
              setPositionLevelsVisible((current) => !current)
            }
            onToggleQuoteButtons={() =>
              setQuoteButtonsVisible((current) => !current)
            }
            point={contextMenu.point}
            position={contextMenu.position}
            positionLevelsHidden={!positionLevelsVisible}
            quoteButtonsVisible={quoteButtonsVisible}
            selectedDrawing={selectedDrawingId !== null}
            symbol={symbol}
            timeframe={timeframe}
          />
        )}
        <div className="chart-overlay">
          {stageSize.width > 0 && stageSize.height > 0 ? (
            <svg
              aria-label="Chart drawing annotations"
              className="chart-drawing-overlay"
              height={stageSize.height}
              viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
              width={stageSize.width}
            >
              {drawingsVisible
                ? drawings.map((drawing) => renderDrawing(drawing))
                : null}
              {draftPreview === null ? null : renderDrawing(draftPreview, true)}
            </svg>
          ) : null}
          {positionLevelsVisible
            ? activePositions.flatMap((position) => {
                const entryTop = overlayTop(position.averageEntryPrice);
                const entry =
                  entryTop === null ? null : (
                    <span
                      className="chart-position-line is-entry"
                      key={`${position.id}:entry`}
                      style={{ top: `${entryTop}px` }}
                    >
                      Entry {position.averageEntryPrice}
                    </span>
                  );
                const protection = (
                  ['STOP_LOSS', 'TAKE_PROFIT'] as ProtectionKind[]
                ).flatMap((kind) => {
                  const existing =
                    kind === 'STOP_LOSS'
                      ? position.stopLossPrice
                      : position.takeProfitPrice;
                  const displayPrice =
                    drag?.position.id === position.id && drag.kind === kind
                      ? drag.price
                      : (existing ?? position.markPrice);
                  if (displayPrice === null) return [];
                  const top = overlayTop(displayPrice);
                  if (top === null) return [];
                  return [
                    <button
                      className={`chart-protection-line is-${kind.toLowerCase()} ${
                        existing === null ? 'is-unset' : ''
                      }`}
                      disabled={!canEditProtection}
                      key={`${position.id}:${kind}`}
                      onPointerDown={(event) =>
                        handleProtectionPointerDown(
                          event,
                          position,
                          kind,
                          displayPrice,
                        )
                      }
                      onPointerMove={handleProtectionPointerMove}
                      onPointerUp={handleProtectionPointerUp}
                      style={{ top: `${top}px` }}
                      title={`Drag to set ${protectionLabel(kind)} for ${position.symbol}`}
                      type="button"
                    >
                      <span>{protectionLabel(kind)}</span>
                      <b>{displayPrice}</b>
                      <i>
                        {existing === null ? 'Drag to set' : 'Drag to modify'}
                      </i>
                    </button>,
                  ];
                });
                return [entry, ...protection];
              })
            : null}
          {measure !== null && measureStyle !== undefined ? (
            <div className="chart-measurement" style={measureStyle}>
              <span>
                {measure.current.price - measure.start.price >= 0 ? '+' : ''}
                {priceText(
                  measure.current.price - measure.start.price,
                  priceScale,
                )}{' '}
                · {measurePips?.toFixed(1)} pips
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <footer className="chart-footnote">
        <span>
          {historyState === 'LOADING'
            ? 'Loading older server history…'
            : `${drawings.length} browser drawing${drawings.length === 1 ? '' : 's'} · select to edit`}
        </span>
        <div className="chart-toolbelt" aria-label="Chart tools">
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            type="button"
          >
            Reset view
          </button>
          <button
            disabled={drawings.length === 0}
            onClick={() => {
              setDrawings([]);
              setSelectedDrawingId(null);
            }}
            type="button"
          >
            Clear drawings
          </button>
        </div>
        <span>
          <span id="chart-tool-status">
            {tool === 'CURSOR'
              ? selectedDrawingId === null
                ? 'Select a drawing to edit'
                : 'Drag line or handles · Delete removes'
              : `${tool === 'MEASURE' ? 'Measure' : drawingLabel(tool)} active`}
          </span>{' '}
          · Right-click for chart tools ·{' '}
          {protectionMessage || 'Mock data · UTC'}
        </span>
      </footer>
    </section>
  );
}
