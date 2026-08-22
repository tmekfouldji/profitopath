import { describe, expect, it } from 'vitest';

import { createDevelopmentCompetitionSeed } from './competition-seed';

describe('development competition seed', () => {
  it('creates the next Monday-to-Friday UTC window deterministically', () => {
    const seed = createDevelopmentCompetitionSeed(
      new Date('2026-08-22T10:15:00.000Z'),
    );

    expect(seed).toMatchObject({
      code: 'DEV-WEEK-20260824',
      rulesVersion: 1,
      signupClosesAt: new Date('2026-08-23T23:00:00.000Z'),
      status: 'SCHEDULED',
      tradingEndsAt: new Date('2026-08-28T23:59:59.999Z'),
      tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
    });
  });

  it('selects the following week when seeded on Monday', () => {
    expect(
      createDevelopmentCompetitionSeed(new Date('2026-08-24T00:00:00.000Z'))
        .code,
    ).toBe('DEV-WEEK-20260831');
  });
});
