import {
  assertStateTransition,
  competitionTransitions,
  type CompetitionState,
  type TransitionGraph,
} from './state-machine';

export interface TransitionAuditRecord<State extends string> {
  action: string;
  actorUserId?: string;
  after: { status: State };
  before: { status: State };
  correlationId?: string;
  entityId: string;
  entityType: string;
  reason?: string;
}

export interface StateTransitionTransaction<State extends string> {
  appendAudit(record: TransitionAuditRecord<State>): Promise<void>;
  readState(entityId: string): Promise<State>;
  writeState(entityId: string, state: State): Promise<void>;
}

export interface StateTransitionStore<State extends string> {
  transaction<Result>(
    operation: (
      transaction: StateTransitionTransaction<State>,
    ) => Promise<Result>,
  ): Promise<Result>;
}

export interface TransitionCommand<State extends string> {
  actorUserId?: string;
  correlationId?: string;
  entityId: string;
  reason?: string;
  to: State;
}

export async function transitionState<State extends string>(
  store: StateTransitionStore<State>,
  entityType: string,
  graph: TransitionGraph<State>,
  command: TransitionCommand<State>,
): Promise<void> {
  await store.transaction(async (transaction) => {
    const from = await transaction.readState(command.entityId);
    assertStateTransition(entityType, graph, from, command.to);
    await transaction.writeState(command.entityId, command.to);
    await transaction.appendAudit({
      action: 'STATE_TRANSITIONED',
      after: { status: command.to },
      before: { status: from },
      entityId: command.entityId,
      entityType,
      ...(command.actorUserId === undefined
        ? {}
        : { actorUserId: command.actorUserId }),
      ...(command.correlationId === undefined
        ? {}
        : { correlationId: command.correlationId }),
      ...(command.reason === undefined ? {} : { reason: command.reason }),
    });
  });
}

export async function transitionCompetition(
  store: StateTransitionStore<CompetitionState>,
  command: TransitionCommand<CompetitionState>,
): Promise<void> {
  return transitionState(store, 'Competition', competitionTransitions, command);
}
