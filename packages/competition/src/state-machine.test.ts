import { describe, expect, it } from 'vitest';

import {
  assertStateTransition,
  competitionEntryTransitions,
  competitionTransitions,
  InvalidStateTransitionError,
  orderTransitions,
  paymentTransitions,
  payoutTransitions,
  prizeTransitions,
  tradingAccountTransitions,
  userTransitions,
} from './state-machine';

describe('domain state machines', () => {
  it('accepts valid transitions', () => {
    expect(() =>
      assertStateTransition(
        'Competition',
        competitionTransitions,
        'DRAFT',
        'SCHEDULED',
      ),
    ).not.toThrow();
    expect(() =>
      assertStateTransition(
        'CompetitionEntry',
        competitionEntryTransitions,
        'PENDING_PAYMENT',
        'ACTIVE',
      ),
    ).not.toThrow();
    expect(() =>
      assertStateTransition(
        'TradingAccount',
        tradingAccountTransitions,
        'PENDING',
        'ACTIVE',
      ),
    ).not.toThrow();
    expect(() =>
      assertStateTransition(
        'Payment',
        paymentTransitions,
        'PENDING',
        'CONFIRMED',
      ),
    ).not.toThrow();
    expect(() =>
      assertStateTransition('Order', orderTransitions, 'ACCEPTED', 'FILLED'),
    ).not.toThrow();
    expect(() =>
      assertStateTransition(
        'Prize',
        prizeTransitions,
        'APPROVED',
        'PAYOUT_PENDING',
      ),
    ).not.toThrow();
    expect(() =>
      assertStateTransition('Payout', payoutTransitions, 'PROCESSING', 'PAID'),
    ).not.toThrow();
    expect(() =>
      assertStateTransition('User', userTransitions, 'SUSPENDED', 'ACTIVE'),
    ).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      assertStateTransition(
        'Competition',
        competitionTransitions,
        'DRAFT',
        'FINALIZED',
      ),
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertStateTransition(
        'CompetitionEntry',
        competitionEntryTransitions,
        'BREACHED',
        'ACTIVE',
      ),
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertStateTransition(
        'TradingAccount',
        tradingAccountTransitions,
        'CLOSED',
        'ACTIVE',
      ),
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertStateTransition(
        'Payment',
        paymentTransitions,
        'CONFIRMED',
        'PENDING',
      ),
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertStateTransition('Order', orderTransitions, 'FILLED', 'ACCEPTED'),
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertStateTransition(
        'Prize',
        prizeTransitions,
        'PAID',
        'PENDING_REVIEW',
      ),
    ).toThrow(InvalidStateTransitionError);
  });
});
