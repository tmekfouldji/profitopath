import { describe, expect, it } from 'vitest';

import type { CompetitionState } from './state-machine';
import {
  transitionCompetition,
  type StateTransitionStore,
  type TransitionAuditRecord,
} from './transition-service';

describe('transitionCompetition', () => {
  it('changes state and appends its audit record in one transaction', async () => {
    let state: CompetitionState = 'DRAFT';
    const audit: TransitionAuditRecord<CompetitionState>[] = [];
    let transactions = 0;
    const store: StateTransitionStore<CompetitionState> = {
      async transaction(operation) {
        transactions += 1;
        return operation({
          async appendAudit(record) {
            audit.push(record);
          },
          async readState() {
            return state;
          },
          async writeState(_entityId, nextState) {
            state = nextState;
          },
        });
      },
    };

    await transitionCompetition(store, {
      actorUserId: 'admin-1',
      entityId: 'competition-1',
      reason: 'Schedule approved weekly window',
      to: 'SCHEDULED',
    });

    expect(transactions).toBe(1);
    expect(state).toBe('SCHEDULED');
    expect(audit).toEqual([
      expect.objectContaining({
        action: 'STATE_TRANSITIONED',
        after: { status: 'SCHEDULED' },
        before: { status: 'DRAFT' },
      }),
    ]);
  });
});
