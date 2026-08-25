/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TerminalChartContextMenu } from './terminal-chart-context-menu';

afterEach(cleanup);

function renderMenu(
  overrides: Partial<Parameters<typeof TerminalChartContextMenu>[0]> = {},
) {
  const handlers = {
    onAddHorizontalRay: vi.fn(),
    onClearDrawings: vi.fn(),
    onClose: vi.fn(),
    onDeleteSelectedDrawing: vi.fn(),
    onFocusLatest: vi.fn(),
    onResetView: vi.fn(),
    onSelectTool: vi.fn(),
    onToggleDrawings: vi.fn(),
    onToggleGrid: vi.fn(),
    onToggleKeepDrawing: vi.fn(),
    onToggleLastPrice: vi.fn(),
    onTogglePositionLevels: vi.fn(),
  };

  render(
    createElement(TerminalChartContextMenu, {
      activeTool: 'CURSOR',
      drawingsHidden: false,
      gridVisible: true,
      keepDrawing: false,
      lastPriceVisible: true,
      point: { price: 1.08432, time: 1_723_967_200 },
      position: { x: 16, y: 20 },
      positionLevelsHidden: false,
      selectedDrawing: false,
      symbol: 'EURUSD',
      timeframe: '1m',
      ...handlers,
      ...overrides,
    }),
  );

  return { ...handlers, ...overrides };
}

describe('terminal chart context menu', () => {
  it('starts supported drawing tools and places a horizontal ray at the clicked price', () => {
    const handlers = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open drawing tools' }));
    fireEvent.click(screen.getByRole('button', { name: /trend line/i }));

    expect(handlers.onSelectTool).toHaveBeenCalledWith('TRENDLINE');
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /horizontal ray/i }));

    expect(handlers.onAddHorizontalRay).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
  });

  it('exposes display and visibility preferences without treating them as trading actions', () => {
    const handlers = renderMenu();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open chart settings' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /hide grid lines/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /hide last price line/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /hide position lines/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /chart settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide drawings/i }));

    expect(handlers.onToggleGrid).toHaveBeenCalledOnce();
    expect(handlers.onToggleLastPrice).toHaveBeenCalledOnce();
    expect(handlers.onToggleDrawings).toHaveBeenCalledOnce();
    expect(handlers.onTogglePositionLevels).toHaveBeenCalledOnce();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it('guards selected-drawing removal until an annotation is selected', () => {
    const handlers = renderMenu();

    expect(
      screen.getByRole('button', { name: /remove selected drawing/i }),
    ).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: /remove drawings/i }));

    expect(handlers.onClearDrawings).toHaveBeenCalledOnce();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it('runs viewport commands and then closes the menu', () => {
    const handlers = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Go to latest bar' }));

    expect(handlers.onFocusLatest).toHaveBeenCalledOnce();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });
});
