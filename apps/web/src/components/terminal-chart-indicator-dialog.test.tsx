/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TerminalChartIndicatorDialog } from './terminal-chart-indicator-dialog';
import { defaultChartIndicatorSettings } from './terminal-chart-indicators';

afterEach(cleanup);

describe('terminal chart indicator settings dialog', () => {
  it('applies a validated study period and enabled state only after confirmation', () => {
    const onApply = vi.fn();

    render(
      createElement(TerminalChartIndicatorDialog, {
        activeIndicators: ['SMA_20'],
        onApply,
        onClose: vi.fn(),
        settings: defaultChartIndicatorSettings,
      }),
    );

    fireEvent.change(screen.getByLabelText('Simple moving average length'), {
      target: { value: '34' },
    });
    fireEvent.click(
      screen.getByLabelText('Exponential moving average visibility'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).toHaveBeenCalledWith({
      activeIndicators: ['SMA_20', 'EMA_50'],
      settings: expect.objectContaining({
        SMA_20: expect.objectContaining({ period: 34 }),
      }),
    });
  });

  it('does not apply settings outside the allowed Bollinger range', () => {
    const onApply = vi.fn();

    render(
      createElement(TerminalChartIndicatorDialog, {
        activeIndicators: ['BOLLINGER'],
        onApply,
        onClose: vi.fn(),
        settings: defaultChartIndicatorSettings,
      }),
    );

    fireEvent.change(screen.getByLabelText('Bollinger deviations'), {
      target: { value: '11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Bollinger deviations must be greater than 0 and no more than 10.',
      ),
    ).toBeTruthy();
  });
});
