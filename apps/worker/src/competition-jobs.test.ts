import { describe, expect, it, vi } from 'vitest';

import {
  CompetitionJobRunner,
  type CompetitionJobServices,
} from './competition-jobs';

function lifecycleResult() {
  return {
    activatedCompetitions: 0,
    capturedScoreInputs: 0,
    completedAccounts: 0,
    completedEntries: 0,
    expiredOrders: 0,
    frozenCompetitions: 0,
  };
}

function services(
  overrides: Partial<CompetitionJobServices> = {},
): CompetitionJobServices {
  return {
    discover: vi.fn().mockResolvedValue([]),
    finalize: vi.fn(),
    processLifecycle: vi.fn().mockResolvedValue(lifecycleResult()),
    recomputeFrozen: vi.fn(),
    recomputeLive: vi.fn(),
    ...overrides,
  };
}

describe('competition job runner', () => {
  it('discovers active and frozen work after lifecycle processing', async () => {
    const dependencies = services({
      discover: vi.fn().mockResolvedValue([
        { id: 'active-1', status: 'ACTIVE' },
        { id: 'frozen-1', status: 'FROZEN' },
      ]),
      recomputeFrozen: vi.fn().mockResolvedValue({}),
      recomputeLive: vi.fn().mockResolvedValue({}),
    });
    const runner = new CompetitionJobRunner({
      autoFinalize: false,
      services: dependencies,
    });
    const now = new Date('2026-08-22T12:00:00.000Z');

    await expect(runner.runOnce(now)).resolves.toMatchObject({
      activeRecomputed: 1,
      failures: [],
      finalized: 0,
      frozenRecomputed: 1,
      skippedOverlap: false,
    });
    expect(dependencies.recomputeLive).toHaveBeenCalledWith({
      asOf: now,
      competitionId: 'active-1',
    });
    expect(dependencies.finalize).not.toHaveBeenCalled();
  });

  it('skips overlapping local cycles and releases the guard for retry', async () => {
    let release!: (value: ReturnType<typeof lifecycleResult>) => void;
    const blocked = new Promise<ReturnType<typeof lifecycleResult>>(
      (resolve) => {
        release = resolve;
      },
    );
    const dependencies = services({ processLifecycle: vi.fn(() => blocked) });
    const runner = new CompetitionJobRunner({
      autoFinalize: false,
      services: dependencies,
    });

    const first = runner.runOnce();
    await expect(runner.runOnce()).resolves.toMatchObject({
      skippedOverlap: true,
    });
    release(lifecycleResult());
    await first;
    await expect(runner.runOnce()).resolves.toMatchObject({
      skippedOverlap: false,
    });
  });

  it('isolates failures for the next cycle and optionally finalizes frozen work', async () => {
    const recomputeLive = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary snapshot failure'))
      .mockResolvedValueOnce({});
    const dependencies = services({
      discover: vi.fn().mockResolvedValue([
        { id: 'active-1', status: 'ACTIVE' },
        { id: 'frozen-1', status: 'FROZEN' },
      ]),
      finalize: vi.fn().mockResolvedValue({ alreadyFinalized: false }),
      recomputeFrozen: vi.fn().mockResolvedValue({}),
      recomputeLive,
    });
    const runner = new CompetitionJobRunner({
      autoFinalize: true,
      services: dependencies,
    });

    await expect(runner.runOnce()).resolves.toMatchObject({
      failures: [
        {
          competitionId: 'active-1',
          operation: 'LIVE_RECOMPUTE',
        },
      ],
      finalized: 1,
    });
    const restartedRunner = new CompetitionJobRunner({
      autoFinalize: true,
      services: dependencies,
    });
    await expect(restartedRunner.runOnce()).resolves.toMatchObject({
      activeRecomputed: 1,
      failures: [],
    });
  });
});
