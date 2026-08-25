'use client';

import { useEffect, useRef, useState } from 'react';

import type { TerminalChartDrawingKind } from './terminal-chart-drawings';

export type TerminalChartCommandTool =
  'CURSOR' | 'MEASURE' | TerminalChartDrawingKind;

export interface TerminalChartMenuPoint {
  price: number;
  time: number;
}

type ChartMenuPanel = 'DISPLAY' | 'DRAWINGS' | 'MAIN';

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
  onToggleQuoteButtons,
  point,
  position,
  positionLevelsHidden,
  quoteButtonsVisible,
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
  onToggleQuoteButtons(): void;
  point: TerminalChartMenuPoint;
  position: { x: number; y: number };
  positionLevelsHidden: boolean;
  quoteButtonsVisible: boolean;
  selectedDrawing: boolean;
  symbol: string;
  timeframe: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<ChartMenuPanel>('MAIN');
  const price = point.price.toFixed(5);

  useEffect(() => {
    menuRef.current?.focus();
  }, [panel]);

  function command(action: () => void) {
    action();
    onClose();
  }

  function selectTool(tool: TerminalChartCommandTool) {
    command(() => onSelectTool(tool));
  }

  function back() {
    setPanel('MAIN');
  }

  return (
    <div
      aria-label="Chart command menu"
      className="chart-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (panel === 'MAIN') onClose();
          else back();
        }
        if (event.key === 'ArrowLeft' && panel !== 'MAIN') {
          event.preventDefault();
          back();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={menuRef}
      role="dialog"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      tabIndex={-1}
    >
      <header className="chart-context-menu-heading">
        <div>
          <strong>{symbol}</strong>
          <small title={pointTime(point.time)}>
            {timeframe} · {price}
          </small>
        </div>
        <button
          aria-label="Close chart command menu"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>

      {panel === 'MAIN' ? (
        <div className="chart-context-menu-list" aria-label="Chart commands">
          <button
            aria-label="Open drawing tools"
            className="chart-context-menu-submenu"
            onClick={() => setPanel('DRAWINGS')}
            type="button"
          >
            <span>Drawing tools</span>
            <b aria-hidden="true">›</b>
          </button>
          <button
            aria-pressed={activeTool === 'MEASURE'}
            onClick={() => selectTool('MEASURE')}
            title="Compare price and pip distance"
            type="button"
          >
            Measure
          </button>
          <button
            aria-label="Open chart settings"
            className="chart-context-menu-submenu"
            onClick={() => setPanel('DISPLAY')}
            type="button"
          >
            <span>Chart settings</span>
            <b aria-hidden="true">›</b>
          </button>
          <span className="chart-context-menu-divider" />
          <button
            aria-pressed={keepDrawing}
            onClick={onToggleKeepDrawing}
            title="Remain in the active drawing tool after placement"
            type="button"
          >
            Keep drawing
            <b aria-hidden="true">{keepDrawing ? '✓' : ''}</b>
          </button>
          <button onClick={onToggleDrawings} type="button">
            {drawingsHidden ? 'Show drawings' : 'Hide drawings'}
          </button>
          <button onClick={() => command(onFocusLatest)} type="button">
            Go to latest bar
          </button>
          <button onClick={() => command(onResetView)} type="button">
            Reset chart view
          </button>
          <span className="chart-context-menu-divider" />
          <button
            disabled={!selectedDrawing}
            onClick={() => command(onDeleteSelectedDrawing)}
            type="button"
          >
            Remove selected drawing
          </button>
          <button onClick={() => command(onClearDrawings)} type="button">
            Remove drawings
          </button>
        </div>
      ) : null}

      {panel === 'DRAWINGS' ? (
        <div className="chart-context-menu-list" aria-label="Drawing tools">
          <button
            className="chart-context-menu-back"
            onClick={back}
            type="button"
          >
            <span aria-hidden="true">‹</span> Drawing tools
          </button>
          <span className="chart-context-menu-divider" />
          <button
            aria-pressed={activeTool === 'CURSOR'}
            onClick={() => selectTool('CURSOR')}
            title="Move or adjust annotations"
            type="button"
          >
            Select and edit
          </button>
          <button
            aria-pressed={activeTool === 'TRENDLINE'}
            onClick={() => selectTool('TRENDLINE')}
            title="Mark direction between two points"
            type="button"
          >
            Trend line
          </button>
          <button
            onClick={() => command(onAddHorizontalRay)}
            title={`Place a ray at ${price}`}
            type="button"
          >
            Horizontal ray
          </button>
          <button
            aria-pressed={activeTool === 'RECTANGLE'}
            onClick={() => selectTool('RECTANGLE')}
            title="Highlight a price range"
            type="button"
          >
            Rectangle
          </button>
          <button
            aria-pressed={activeTool === 'LONG_POSITION'}
            onClick={() => selectTool('LONG_POSITION')}
            title="Visual risk and reward plan only"
            type="button"
          >
            Long position
          </button>
          <button
            aria-pressed={activeTool === 'SHORT_POSITION'}
            onClick={() => selectTool('SHORT_POSITION')}
            title="Visual risk and reward plan only"
            type="button"
          >
            Short position
          </button>
        </div>
      ) : null}

      {panel === 'DISPLAY' ? (
        <div className="chart-context-menu-list" aria-label="Chart settings">
          <button
            className="chart-context-menu-back"
            onClick={back}
            type="button"
          >
            <span aria-hidden="true">‹</span> Chart settings
          </button>
          <span className="chart-context-menu-divider" />
          <button onClick={onToggleGrid} type="button">
            {gridVisible ? 'Hide grid lines' : 'Show grid lines'}
          </button>
          <button onClick={onToggleLastPrice} type="button">
            {lastPriceVisible ? 'Hide last price line' : 'Show last price line'}
          </button>
          <button onClick={onTogglePositionLevels} type="button">
            {positionLevelsHidden
              ? 'Show position lines'
              : 'Hide position lines'}
          </button>
          <button onClick={onToggleQuoteButtons} type="button">
            {quoteButtonsVisible
              ? 'Hide Buy/Sell buttons'
              : 'Show Buy/Sell buttons'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
