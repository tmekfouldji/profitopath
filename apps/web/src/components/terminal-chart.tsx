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
  onProtectionDrop,
  positions,
  protectionMessage,
  symbol,
}: {
  accountId: string;
  canEditProtection: boolean;
  historyAnchor: string;
  initialCandles: TerminalChartCandle[];
  initialSymbol: string;
  liveCandle: TerminalChartCandle | null;
  markers: TerminalChartMarker[];
  onProtectionDrop(input: {
    kind: ProtectionKind;
    position: TerminalChartPosition;
    price: string;
  }): void;
  positions: TerminalChartPosition[];
  protectionMessage: string;
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef(initialCandles);
  const drawingDraftRef = useRef<DrawingDraft | null>(null);
  const drawingEditRef = useRef<DrawingEdit | null>(null);
  const historyStateRef = useRef<'IDLE' | 'LOADING' | 'EXHAUSTED'>('IDLE');
  const indicatorSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeframeRef = useRef<ChartTimeframe>('1m');
  const loadingOlderRef = useRef(false);
  const [candles, setCandles] = useState(initialCandles);
  const [chartGeneration, setChartGeneration] = useState(0);
  const [drag, setDrag] = useState<ProtectionDrag | null>(null);
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft | null>(null);
  const [drawings, setDrawings] = useState<TerminalChartDrawing[]>([]);
  const [drawingsScope, setDrawingsScope] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<
    'IDLE' | 'LOADING' | 'EXHAUSTED'
  >('IDLE');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [indicatorSettings, setIndicatorSettings] = useState(() =>
    cloneChartIndicatorSettings(defaultChartIndicatorSettings),
  );
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [measure, setMeasure] = useState<MeasureDrag | null>(null);
  const [overlayRevision, setOverlayRevision] = useState(0);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1m');
  const [tool, setTool] = useState<ChartTool>('CURSOR');

  const activePositions = useMemo(
    () => positions.filter((position) => position.symbol === symbol),
    [positions, symbol],
  );
  const priceScale = activePositions[0]?.priceScale ?? 5;

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
        rightOffset: 5,
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
    const chart = chartRef.current;
    if (chart === null) return;
    const activeChart = chart;
    for (const series of indicatorSeriesRef.current) {
      activeChart.removeSeries(series);
    }
    indicatorSeriesRef.current = [];
    const studyCandles = chartData(candles).map((candle) => ({
      close: candle.close,
      time: Number(candle.time),
    }));
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
  }, [candles, chartGeneration, indicatorSettings, indicators]);

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

  function toggleIndicator(indicator: Indicator) {
    setIndicators((current) =>
      current.includes(indicator)
        ? current.filter((entry) => entry !== indicator)
        : [...current, indicator],
    );
  }

  function chartPoint(event: PointerEvent<Element>): ChartPoint | null {
    const stage = stageRef.current;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (stage === null || series === null || chart === null) return null;
    const bounds = stage.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const price = series.coordinateToPrice(y as Coordinate);
    const time = chart.timeScale().coordinateToTime(x as Coordinate);
    if (price === null || typeof time !== 'number') return null;
    return { price, time, x, y };
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
    if (event.button !== 0 || tool === 'CURSOR') return;
    const point = chartPoint(event);
    if (point === null) return;
    event.preventDefault();
    if (tool === 'HORIZONTAL_RAY') {
      const drawing: TerminalChartDrawing = {
        first: { price: point.price, time: point.time },
        id: drawingId(),
        kind: tool,
        version: 1,
      };
      setDrawings((current) => [...current, drawing]);
      setSelectedDrawingId(drawing.id);
      setTool('CURSOR');
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
      setTool('CURSOR');
      return;
    }
    if (measure?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setTool('CURSOR');
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
    if (event.key === 'Escape') {
      event.preventDefault();
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
    const x = chartRef.current
      ?.timeScale()
      .timeToCoordinate(point.time as Time);
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
    <section className="terminal-chart-panel" aria-label={`${symbol} chart`}>
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
            {indicatorOrder.map((indicator) => (
              <button
                aria-pressed={indicators.includes(indicator)}
                className={
                  indicators.includes(indicator) ? 'is-active' : undefined
                }
                key={indicator}
                onClick={() => toggleIndicator(indicator)}
                title={`Toggle ${indicatorLabel(indicator, indicatorSettings)}`}
                type="button"
              >
                {indicatorLabel(indicator, indicatorSettings)}
              </button>
            ))}
          </div>
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
        onKeyDown={handleStageKeyDown}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        ref={stageRef}
        tabIndex={0}
      >
        <div className="chart-canvas" ref={containerRef} />
        <aside
          className="chart-drawing-toolbar"
          aria-label="Chart drawing tools"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label="Select and edit drawings"
            aria-pressed={tool === 'CURSOR'}
            onClick={() => setTool('CURSOR')}
            title="Select and edit drawings (Escape)"
            type="button"
          >
            <span aria-hidden="true">⌖</span>
            <small>Select</small>
          </button>
          <button
            aria-label="Draw trend line"
            aria-pressed={tool === 'TRENDLINE'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('TRENDLINE');
            }}
            title="Trend line"
            type="button"
          >
            <span aria-hidden="true">↗</span>
            <small>Trend</small>
          </button>
          <button
            aria-label="Draw horizontal ray"
            aria-pressed={tool === 'HORIZONTAL_RAY'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('HORIZONTAL_RAY');
            }}
            title="Horizontal ray"
            type="button"
          >
            <span aria-hidden="true">—›</span>
            <small>Ray</small>
          </button>
          <button
            aria-label="Draw rectangle zone"
            aria-pressed={tool === 'RECTANGLE'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('RECTANGLE');
            }}
            title="Rectangle zone"
            type="button"
          >
            <span aria-hidden="true">□</span>
            <small>Zone</small>
          </button>
          <button
            aria-label="Draw long position plan"
            aria-pressed={tool === 'LONG_POSITION'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('LONG_POSITION');
            }}
            title="Long position risk/reward plan"
            type="button"
          >
            <span aria-hidden="true">L</span>
            <small>Long</small>
          </button>
          <button
            aria-label="Draw short position plan"
            aria-pressed={tool === 'SHORT_POSITION'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('SHORT_POSITION');
            }}
            title="Short position risk/reward plan"
            type="button"
          >
            <span aria-hidden="true">S</span>
            <small>Short</small>
          </button>
          <button
            aria-label="Measure price and time range"
            aria-pressed={tool === 'MEASURE'}
            onClick={() => {
              setSelectedDrawingId(null);
              setTool('MEASURE');
            }}
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
            onClick={() => {
              setDrawings((current) =>
                current.filter((drawing) => drawing.id !== selectedDrawingId),
              );
              setSelectedDrawingId(null);
            }}
            title="Delete selected drawing (Delete)"
            type="button"
          >
            <span aria-hidden="true">×</span>
            <small>Delete</small>
          </button>
        </aside>
        <div className="chart-overlay">
          {stageSize.width > 0 && stageSize.height > 0 ? (
            <svg
              aria-label="Chart drawing annotations"
              className="chart-drawing-overlay"
              height={stageSize.height}
              viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
              width={stageSize.width}
            >
              {drawings.map((drawing) => renderDrawing(drawing))}
              {draftPreview === null ? null : renderDrawing(draftPreview, true)}
            </svg>
          ) : null}
          {activePositions.flatMap((position) => {
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
                  <i>{existing === null ? 'Drag to set' : 'Drag to modify'}</i>
                </button>,
              ];
            });
            return [entry, ...protection];
          })}
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
          · {protectionMessage || 'Mock data · UTC'}
        </span>
      </footer>
    </section>
  );
}
