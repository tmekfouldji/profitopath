import type {
  CanonicalLeaderboardResult,
  CompetitionLifecycleResult,
  FinalizeLeaderboardResult,
} from '@profitopath/competition';

export interface CompetitionJobCandidate {
  id: string;
  status: 'ACTIVE' | 'FROZEN';
}

export interface CompetitionJobFailure {
  competitionId: string;
  message: string;
  operation: 'FINALIZE' | 'LIVE_RECOMPUTE' | 'FROZEN_RECOMPUTE';
}

export interface CompetitionJobRunResult {
  activeRecomputed: number;
  failures: CompetitionJobFailure[];
  finalized: number;
  frozenRecomputed: number;
  lifecycle: CompetitionLifecycleResult | null;
  skippedOverlap: boolean;
}

export interface CompetitionJobServices {
  discover(): Promise<CompetitionJobCandidate[]>;
  finalize(competitionId: string): Promise<FinalizeLeaderboardResult>;
  processLifecycle(now: Date): Promise<CompetitionLifecycleResult>;
  recomputeFrozen(competitionId: string): Promise<CanonicalLeaderboardResult>;
  recomputeLive(input: {
    asOf: Date;
    competitionId: string;
  }): Promise<CanonicalLeaderboardResult>;
}

function failureMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown competition job error';
}

export class CompetitionJobRunner {
  readonly #autoFinalize: boolean;
  #running = false;
  readonly #services: CompetitionJobServices;

  constructor(input: {
    autoFinalize: boolean;
    services: CompetitionJobServices;
  }) {
    this.#autoFinalize = input.autoFinalize;
    this.#services = input.services;
  }

  async runOnce(now: Date = new Date()): Promise<CompetitionJobRunResult> {
    if (this.#running) {
      return {
        activeRecomputed: 0,
        failures: [],
        finalized: 0,
        frozenRecomputed: 0,
        lifecycle: null,
        skippedOverlap: true,
      };
    }
    this.#running = true;
    const result: CompetitionJobRunResult = {
      activeRecomputed: 0,
      failures: [],
      finalized: 0,
      frozenRecomputed: 0,
      lifecycle: null,
      skippedOverlap: false,
    };
    try {
      result.lifecycle = await this.#services.processLifecycle(now);
      const candidates = await this.#services.discover();
      for (const candidate of candidates) {
        if (candidate.status === 'ACTIVE') {
          try {
            await this.#services.recomputeLive({
              asOf: now,
              competitionId: candidate.id,
            });
            result.activeRecomputed += 1;
          } catch (error) {
            result.failures.push({
              competitionId: candidate.id,
              message: failureMessage(error),
              operation: 'LIVE_RECOMPUTE',
            });
          }
          continue;
        }
        try {
          await this.#services.recomputeFrozen(candidate.id);
          result.frozenRecomputed += 1;
        } catch (error) {
          result.failures.push({
            competitionId: candidate.id,
            message: failureMessage(error),
            operation: 'FROZEN_RECOMPUTE',
          });
          continue;
        }
        if (!this.#autoFinalize) continue;
        try {
          const finalized = await this.#services.finalize(candidate.id);
          if (!finalized.alreadyFinalized) result.finalized += 1;
        } catch (error) {
          result.failures.push({
            competitionId: candidate.id,
            message: failureMessage(error),
            operation: 'FINALIZE',
          });
        }
      }
      return result;
    } finally {
      this.#running = false;
    }
  }
}
