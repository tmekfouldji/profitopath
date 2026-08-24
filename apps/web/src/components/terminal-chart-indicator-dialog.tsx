'use client';

import { useEffect, useState } from 'react';

import {
  cloneChartIndicatorSettings,
  defaultChartIndicatorSettings,
  indicatorLabel,
  validateChartIndicatorSettings,
  type ChartIndicatorId,
  type ChartIndicatorSettings,
} from './terminal-chart-indicators';

const indicatorOrder: readonly ChartIndicatorId[] = [
  'SMA_20',
  'EMA_50',
  'BOLLINGER',
];

const indicatorNames: Record<ChartIndicatorId, string> = {
  BOLLINGER: 'Bollinger Bands',
  EMA_50: 'Exponential moving average',
  SMA_20: 'Simple moving average',
};

export function TerminalChartIndicatorDialog({
  activeIndicators,
  onApply,
  onClose,
  settings,
}: {
  activeIndicators: readonly ChartIndicatorId[];
  onApply(input: {
    activeIndicators: ChartIndicatorId[];
    settings: ChartIndicatorSettings;
  }): void;
  onClose(): void;
  settings: ChartIndicatorSettings;
}) {
  const [active, setActive] = useState<ChartIndicatorId[]>([
    ...activeIndicators,
  ]);
  const [draft, setDraft] = useState(() =>
    cloneChartIndicatorSettings(settings),
  );
  const [error, setError] = useState<string>();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function toggle(indicator: ChartIndicatorId) {
    setActive((current) =>
      current.includes(indicator)
        ? current.filter((entry) => entry !== indicator)
        : [...current, indicator],
    );
  }

  function setPeriod(indicator: ChartIndicatorId, value: string) {
    setDraft((current) => ({
      ...current,
      [indicator]: { ...current[indicator], period: Number(value) },
    }));
  }

  function setColor(indicator: ChartIndicatorId, color: string) {
    setDraft((current) => ({
      ...current,
      [indicator]: { ...current[indicator], color },
    }));
  }

  function submit() {
    const validation = validateChartIndicatorSettings(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    onApply({ activeIndicators: active, settings: validation.value });
  }

  return (
    <div
      aria-labelledby="indicator-settings-title"
      aria-modal="true"
      className="indicator-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <section className="indicator-dialog">
        <header>
          <div>
            <span className="data-label">Chart studies</span>
            <h2 id="indicator-settings-title">Indicator settings</h2>
          </div>
          <button
            aria-label="Close indicator settings"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <p>
          Configure a study before applying it to the chart. These display
          settings never affect order execution.
        </p>
        <div className="indicator-setting-list">
          {indicatorOrder.map((indicator) => {
            const enabled = active.includes(indicator);
            const values = draft[indicator];
            return (
              <fieldset
                className={enabled ? '' : 'is-disabled'}
                key={indicator}
              >
                <legend>{indicatorNames[indicator]}</legend>
                <label className="indicator-enabled">
                  <input
                    aria-label={`${indicatorNames[indicator]} visibility`}
                    checked={enabled}
                    onChange={() => toggle(indicator)}
                    type="checkbox"
                  />
                  <span>
                    {enabled ? 'Shown on chart' : 'Hidden from chart'}
                  </span>
                </label>
                <div className="indicator-setting-fields">
                  <label>
                    <span>Length</span>
                    <input
                      aria-label={`${indicatorNames[indicator]} length`}
                      max="500"
                      min="1"
                      onChange={(event) =>
                        setPeriod(indicator, event.target.value)
                      }
                      step="1"
                      type="number"
                      value={
                        Number.isFinite(values.period) ? values.period : ''
                      }
                    />
                  </label>
                  {indicator === 'BOLLINGER' ? (
                    <label>
                      <span>Deviations</span>
                      <input
                        aria-label="Bollinger deviations"
                        max="10"
                        min="0.1"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            BOLLINGER: {
                              ...current.BOLLINGER,
                              deviations: Number(event.target.value),
                            },
                          }))
                        }
                        step="0.1"
                        type="number"
                        value={
                          Number.isFinite(draft.BOLLINGER.deviations)
                            ? draft.BOLLINGER.deviations
                            : ''
                        }
                      />
                    </label>
                  ) : null}
                  <label className="indicator-color">
                    <span>Line color</span>
                    <input
                      aria-label={`${indicatorNames[indicator]} line color`}
                      onChange={(event) =>
                        setColor(indicator, event.target.value)
                      }
                      type="color"
                      value={values.color}
                    />
                  </label>
                </div>
                <small>{indicatorLabel(indicator, draft)}</small>
              </fieldset>
            );
          })}
        </div>
        {error === undefined ? null : (
          <p aria-live="polite" className="indicator-dialog-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            className="indicator-dialog-reset"
            onClick={() => {
              setDraft(
                cloneChartIndicatorSettings(defaultChartIndicatorSettings),
              );
              setError(undefined);
            }}
            type="button"
          >
            Reset defaults
          </button>
          <span />
          <button onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="indicator-dialog-apply"
            onClick={submit}
            type="button"
          >
            Apply changes
          </button>
        </footer>
      </section>
    </div>
  );
}
