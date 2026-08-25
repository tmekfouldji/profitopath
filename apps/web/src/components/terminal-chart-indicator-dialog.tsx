'use client';

import { useEffect, useState } from 'react';

import {
  chartIndicatorKinds,
  chartIndicatorName,
  cloneChartIndicatorInstances,
  createChartIndicatorInstance,
  indicatorLabel,
  maximumChartIndicatorInstances,
  validateChartIndicatorInstances,
  type ChartIndicatorInstance,
  type ChartIndicatorKind,
} from './terminal-chart-indicators';

function occurrence(
  instances: readonly ChartIndicatorInstance[],
  instance: ChartIndicatorInstance,
): number {
  return instances
    .filter((candidate) => candidate.kind === instance.kind)
    .findIndex((candidate) => candidate.id === instance.id);
}

function instanceName(
  instances: readonly ChartIndicatorInstance[],
  instance: ChartIndicatorInstance,
): string {
  const instancesOfKind = instances.filter(
    (candidate) => candidate.kind === instance.kind,
  );
  if (instancesOfKind.length === 1) return chartIndicatorName(instance.kind);
  return `${chartIndicatorName(instance.kind)} ${occurrence(instances, instance) + 1}`;
}

export function TerminalChartIndicatorDialog({
  instances,
  onApply,
  onClose,
  selectedStudyId,
}: {
  instances: readonly ChartIndicatorInstance[];
  onApply(instances: ChartIndicatorInstance[]): void;
  onClose(): void;
  selectedStudyId: string | null;
}) {
  const [draft, setDraft] = useState(() =>
    cloneChartIndicatorInstances(instances),
  );
  const [error, setError] = useState<string>();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function addStudy(kind: ChartIndicatorKind) {
    setDraft((current) => {
      if (current.length >= maximumChartIndicatorInstances) return current;
      const count = current.filter((item) => item.kind === kind).length;
      return [
        ...current,
        createChartIndicatorInstance(kind, crypto.randomUUID(), count),
      ];
    });
    setError(undefined);
  }

  function updateStudy(id: string, patch: Partial<ChartIndicatorInstance>) {
    setDraft((current) =>
      current.map((instance) =>
        instance.id === id ? { ...instance, ...patch } : instance,
      ),
    );
  }

  function resetDefaults() {
    setDraft((current) => {
      const counts = new Map<ChartIndicatorKind, number>();
      return current.map((instance) => {
        const count = counts.get(instance.kind) ?? 0;
        counts.set(instance.kind, count + 1);
        return createChartIndicatorInstance(instance.kind, instance.id, count);
      });
    });
    setError(undefined);
  }

  function submit() {
    const validation = validateChartIndicatorInstances(draft);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    onApply(validation.value);
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
          Add independent studies and configure each one before applying. These
          display settings never affect order execution.
        </p>
        <div className="indicator-add-tools" aria-label="Add a chart study">
          <span>Add study</span>
          {chartIndicatorKinds.map((kind) => (
            <button
              disabled={draft.length >= maximumChartIndicatorInstances}
              key={kind}
              onClick={() => addStudy(kind)}
              type="button"
            >
              {kind === 'BOLLINGER' ? 'Bollinger' : kind}
            </button>
          ))}
          <small>
            {draft.length} / {maximumChartIndicatorInstances}
          </small>
        </div>
        <div className="indicator-setting-list">
          {draft.length === 0 ? (
            <p className="indicator-empty">
              Add a study to show it on the chart.
            </p>
          ) : (
            draft.map((instance) => {
              const name = instanceName(draft, instance);
              return (
                <fieldset
                  className={
                    instance.id === selectedStudyId ? 'is-selected' : undefined
                  }
                  key={instance.id}
                >
                  <legend>{name}</legend>
                  <button
                    aria-label={`Remove ${name}`}
                    className="indicator-remove"
                    onClick={() =>
                      setDraft((current) =>
                        current.filter((item) => item.id !== instance.id),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                  <div className="indicator-setting-fields">
                    <label>
                      <span>Length</span>
                      <input
                        aria-label={`${name} length`}
                        max="500"
                        min="1"
                        onChange={(event) =>
                          updateStudy(instance.id, {
                            period: Number(event.target.value),
                          })
                        }
                        step="1"
                        type="number"
                        value={
                          Number.isFinite(instance.period)
                            ? instance.period
                            : ''
                        }
                      />
                    </label>
                    {instance.kind === 'BOLLINGER' ? (
                      <label>
                        <span>Deviations</span>
                        <input
                          aria-label={`${name} deviations`}
                          max="10"
                          min="0.1"
                          onChange={(event) =>
                            updateStudy(instance.id, {
                              deviations: Number(event.target.value),
                            })
                          }
                          step="0.1"
                          type="number"
                          value={
                            Number.isFinite(instance.deviations)
                              ? instance.deviations
                              : ''
                          }
                        />
                      </label>
                    ) : null}
                    <label className="indicator-color">
                      <span>Line color</span>
                      <input
                        aria-label={`${name} line color`}
                        onChange={(event) =>
                          updateStudy(instance.id, {
                            color: event.target.value,
                          })
                        }
                        type="color"
                        value={instance.color}
                      />
                    </label>
                  </div>
                  <small>{indicatorLabel(instance)}</small>
                </fieldset>
              );
            })
          )}
        </div>
        {error === undefined ? null : (
          <p aria-live="polite" className="indicator-dialog-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            className="indicator-dialog-reset"
            disabled={draft.length === 0}
            onClick={resetDefaults}
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
