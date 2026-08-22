export type CompetitionState =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'FROZEN'
  | 'FINALIZED'
  | 'ARCHIVED'
  | 'CANCELLED';

export type CompetitionEntryState =
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'BREACHED'
  | 'DISQUALIFIED'
  | 'CANCELLED';

export type TradingAccountState =
  'PENDING' | 'ACTIVE' | 'BREACHED' | 'DISQUALIFIED' | 'COMPLETED' | 'CLOSED';

export type PaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

export type UserState = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export type OrderState =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export type PrizeState =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAYOUT_PENDING'
  | 'PAID'
  | 'VOID';

export type PayoutState =
  'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type TransitionGraph<State extends string> = Readonly<
  Record<State, readonly State[]>
>;

export const competitionTransitions: TransitionGraph<CompetitionState> = {
  ACTIVE: ['FROZEN', 'CANCELLED'],
  ARCHIVED: [],
  CANCELLED: ['ARCHIVED'],
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  FINALIZED: ['ARCHIVED'],
  FROZEN: ['FINALIZED', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'CANCELLED'],
};

export const competitionEntryTransitions: TransitionGraph<CompetitionEntryState> =
  {
    ACTIVE: ['COMPLETED', 'BREACHED', 'DISQUALIFIED', 'CANCELLED'],
    BREACHED: [],
    CANCELLED: [],
    COMPLETED: [],
    DISQUALIFIED: [],
    PENDING_PAYMENT: ['ACTIVE', 'CANCELLED'],
  };

export const tradingAccountTransitions: TransitionGraph<TradingAccountState> = {
  ACTIVE: ['BREACHED', 'DISQUALIFIED', 'COMPLETED', 'CLOSED'],
  BREACHED: ['CLOSED'],
  CLOSED: [],
  COMPLETED: ['CLOSED'],
  DISQUALIFIED: ['CLOSED'],
  PENDING: ['ACTIVE', 'CLOSED'],
};

export const paymentTransitions: TransitionGraph<PaymentState> = {
  CANCELLED: [],
  CONFIRMED: ['REFUNDED'],
  CREATED: ['PENDING', 'CANCELLED'],
  EXPIRED: [],
  FAILED: [],
  PENDING: ['CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  REFUNDED: [],
};

export const userTransitions: TransitionGraph<UserState> = {
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  CLOSED: [],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
};

export const orderTransitions: TransitionGraph<OrderState> = {
  ACCEPTED: ['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED'],
  CANCELLED: [],
  EXPIRED: [],
  FILLED: [],
  PARTIALLY_FILLED: ['FILLED', 'CANCELLED', 'EXPIRED'],
  PENDING: ['ACCEPTED', 'CANCELLED', 'REJECTED'],
  REJECTED: [],
};

export const prizeTransitions: TransitionGraph<PrizeState> = {
  APPROVED: ['PAYOUT_PENDING', 'VOID'],
  PAID: [],
  PAYOUT_PENDING: ['PAID', 'VOID'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'VOID'],
  REJECTED: [],
  VOID: [],
};

export const payoutTransitions: TransitionGraph<PayoutState> = {
  APPROVED: ['PROCESSING', 'CANCELLED'],
  CANCELLED: [],
  FAILED: ['PROCESSING', 'CANCELLED'],
  PAID: [],
  PENDING: ['APPROVED', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED'],
};

export class InvalidStateTransitionError extends Error {
  constructor(entityType: string, from: string, to: string) {
    super(`Invalid ${entityType} state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function assertStateTransition<State extends string>(
  entityType: string,
  graph: TransitionGraph<State>,
  from: State,
  to: State,
): void {
  if (!graph[from].includes(to)) {
    throw new InvalidStateTransitionError(entityType, from, to);
  }
}
