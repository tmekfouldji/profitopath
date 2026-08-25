/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TerminalChartIndicatorDialog } from './terminal-chart-indicator-dialog';

afterEach(cleanup);

function dialog(onApply = vi.fn()) {
  render(
    createElement(TerminalChartIndicatorDialog, {
      instances: [],
      onApply,
      onClose: vi.fn(),
      selectedStudyId: null,
    }),
  );
  return onApply;
}

describe('terminal chart indicator settings dialog', () => {
  it('adds and applies multiple independent instances of the same study', () => {
    const onApply = dialog();

    fireEvent.click(screen.getByRole('button', { name: 'SMA' }));
    fireEvent.click(screen.getByRole('button', { name: 'SMA' }));
    fireEvent.change(screen.getByLabelText('Simple moving average 2 length'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'SMA', period: 20 }),
      expect.objectContaining({ kind: 'SMA', period: 50 }),
    ]);
  });

  it('removes an individual study instance before applying', () => {
    const onApply = dialog();

    fireEvent.click(screen.getByRole('button', { name: 'EMA' }));
    fireEvent.click(screen.getByRole('button', { name: 'EMA' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Exponential moving average 2',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'EMA', period: 50 }),
    ]);
  });

  it('does not apply settings outside the allowed Bollinger range', () => {
    const onApply = dialog();

    fireEvent.click(screen.getByRole('button', { name: 'Bollinger' }));
    fireEvent.change(screen.getByLabelText('Bollinger Bands deviations'), {
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
