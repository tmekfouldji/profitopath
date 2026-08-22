import { describe, expect, it } from 'vitest';

import { deriveLiveTraderEligibility } from './trader-leaderboards';

const eligible = {
  accountStatus: 'ACTIVE' as const,
  competitionStatus: 'ACTIVE' as const,
  disqualifiedAt: null,
  entryStatus: 'ACTIVE' as const,
  hasRuleBreach: false,
  hasSnapshot: true,
};

describe('trader leaderboard eligibility projection', () => {
  it('reports explicit server-side ineligibility reasons', () => {
    expect(deriveLiveTraderEligibility(eligible)).toBe('ELIGIBLE');
    expect(
      deriveLiveTraderEligibility({ ...eligible, hasRuleBreach: true }),
    ).toBe('RULE_BREACH');
    expect(
      deriveLiveTraderEligibility({ ...eligible, hasSnapshot: false }),
    ).toBe('MISSING_SNAPSHOT');
    expect(
      deriveLiveTraderEligibility({
        ...eligible,
        disqualifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toBe('DISQUALIFIED');
  });

  it('does not claim a rank before the competition starts', () => {
    expect(
      deriveLiveTraderEligibility({
        ...eligible,
        competitionStatus: 'SCHEDULED',
      }),
    ).toBe('NOT_STARTED');
  });
});
