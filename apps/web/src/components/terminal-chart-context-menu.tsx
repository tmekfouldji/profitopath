'use client';

import { useEffect, useRef } from 'react';

import type { TerminalChartDrawingKind } from './terminal-chart-drawings';

export type TerminalChartCommandTool =
  'CURSOR' | 'MEASURE' | TerminalChartDrawingKind;

export interface TerminalChartMenuPoint {
  price: number;
  time: number;
}

function pointTime(value: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value * 1_000));
}

export function TerminalChartContextMenu({
  activeTool,
  drawingsHidden,
  gridVisible,
  keepDrawing,
  lastPriceVisible,
  onAddHorizontalRay,
  onClearDrawings,
  onClose,
  onDeleteSelectedDrawing,
  onFocusLatest,
  onResetView,
  onSelectTool,
  onToggleDrawings,
  onToggleGrid,
  onToggleKeepDrawing,
  onToggleLastPrice,
  onTogglePositionLevels,
  point,
  position,
  positionLevelsHidden,
  selectedDrawing,
  symbol,
  timeframe,
}: {
  activeTool: TerminalChartCommandTool;
  drawingsHidden: boolean;
  gridVisible: boolean;
  keepDrawing: boolean;
  lastPriceVisible: boolean;
  onAddHorizontalRay(): void;
  onClearDrawings(): void;
  onClose(): void;
  onDeleteSelectedDrawing(): void;
  onFocusLatest(): void;
  onResetView(): void;
  onSelectTool(tool: TerminalChartCommandTool): void;
  onToggleDrawings(): void;
  onToggleGrid(): void;
  onToggleKeepDrawing(): void;
  onToggleLastPrice(): void;
  onTogglePositionLevels(): void;
  point: TerminalChartMenuPoint;
  position: { x: number; y: number };
  positionLevelsHidden: boolean;
  selectedDrawing: boolean;
  symbol: string;
  timeframe: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.focus();
  }, []);

  function command(action: () => void) {
    action();
    onClose();
  }

  const price = point.price.toFixed(5);

  return (
    <div
      aria-label="Chart command menu"
      className="chart-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={menuRef}
      role="dialog"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      tabIndex={-1}
    >
      <header className="chart-context-menu-heading">
        <span>
          {symbol} / {timeframe}
        </span>
        <button
          aria-label="Close chart command menu"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <strong>{price}</strong>
        <small>{pointTime(point.time)}</small>
      </header>

      <section
        aria-label="Drawing commands"
        className="chart-context-menu-section"
      >
        <span className="chart-context-menu-label">Draw</span>
        <button
          aria-pressed={activeTool === 'CURSOR'}
          onClick={() => command(() => onSelectTool('CURSOR'))}
          type="button"
        >
          <span>⌖</span>
          <b>Select and edit</b>
          <small>Move or adjust annotations</small>
        </button>
        <button
          aria-pressed={activeTool === 'TRENDLINE'}
          onClick={() => command(() => onSelectTool('TRENDLINE'))}
          type="button"
        >
          <span>↗</span>
          <b>Trend line</b>
          <small>Mark direction between two points</small>
        </button>
        <button onClick={() => command(onAddHorizontalRay)} type="button">
          <span>—›</span>
          <b>Horizontal ray</b>
          <small>Place at {price}</small>
        </button>
        <button
          aria-pressed={activeTool === 'RECTANGLE'}
          onClick={() => command(() => onSelectTool('RECTANGLE'))}
          type="button"
        >
          <span>□</span>
          <b>Rectangle zone</b>
          <small>Highlight a price range</small>
        </button>
        <button
          aria-pressed={activeTool === 'LONG_POSITION'}
          onClick={() => command(() => onSelectTool('LONG_POSITION'))}
          type="button"
        >
          <span>L</span>
          <b>Long position plan</b>
          <small>Visual risk and reward only</small>
        </button>
        <button
          aria-pressed={activeTool === 'SHORT_POSITION'}
          onClick={() => command(() => onSelectTool('SHORT_POSITION'))}
          type="button"
        >
          <span>S</span>
          <b>Short position plan</b>
          <small>Visual risk and reward only</small>
        </button>
        <button
          aria-pressed={activeTool === 'MEASURE'}
          onClick={() => command(() => onSelectTool('MEASURE'))}
          type="button"
        >
          <span>↕</span>
          <b>Measure range</b>
          <small>Compare price and pip distance</small>
        </button>
      </section>

      <section
        aria-label="Chart view commands"
        className="chart-context-menu-section"
      >
        <span className="chart-context-menu-label">Chart</span>
        <button onClick={() => command(onFocusLatest)} type="button">
          <span>↻</span>
          <b>Go to latest quote</b>
          <small>Return to the live edge</small>
        </button>
        <button onClick={() => command(onResetView)} type="button">
          <span>⌗</span>
          <b>Reset chart view</b>
          <small>Fit loaded server history</small>
        </button>
        <button onClick={onToggleGrid} type="button">
          <span>▦</span>
          <b>{gridVisible ? 'Hide grid' : 'Show grid'}</b>
          <small>Chart canvas preference</small>
        </button>
        <button onClick={onToggleLastPrice} type="button">
          <span>⌁</span>
          <b>{lastPriceVisible ? 'Hide last price' : 'Show last price'}</b>
          <small>Price-scale display preference</small>
        </button>
      </section>

      <section
        aria-label="Drawing management commands"
        className="chart-context-menu-section"
      >
        <span className="chart-context-menu-label">Manage</span>
        <button onClick={onToggleKeepDrawing} type="button">
          <span>∞</span>
          <b>{keepDrawing ? 'Keep drawing: on' : 'Keep drawing: off'}</b>
          <small>Stay in the active drawing tool</small>
        </button>
        <button onClick={onToggleDrawings} type="button">
          <span>◌</span>
          <b>{drawingsHidden ? 'Show drawings' : 'Hide drawings'}</b>
          <small>Browser-only annotations</small>
        </button>
        <button onClick={onTogglePositionLevels} type="button">
          <span>≡</span>
          <b>
            {positionLevelsHidden
              ? 'Show position levels'
              : 'Hide position levels'}
          </b>
          <small>Entry, stop, and target lines</small>
        </button>
        <button
          disabled={!selectedDrawing}
          onClick={() => command(onDeleteSelectedDrawing)}
          type="button"
        >
          <span>×</span>
          <b>Remove selected drawing</b>
          <small>
            {selectedDrawing
              ? 'Delete the active annotation'
              : 'Select a drawing first'}
          </small>
        </button>
        <button onClick={() => command(onClearDrawings)} type="button">
          <span>⌫</span>
          <b>Clear all drawings</b>
          <small>Remove local annotations only</small>
        </button>
      </section>
    </div>
  );
}
