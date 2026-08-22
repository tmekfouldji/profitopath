export interface CompetitionSeed {
  code: string;
  name: string;
  rulesVersion: number;
  signupClosesAt: Date;
  status: 'SCHEDULED';
  timezone: 'UTC';
  tradingEndsAt: Date;
  tradingStartsAt: Date;
}

const dayMs = 24 * 60 * 60 * 1000;

export function createDevelopmentCompetitionSeed(
  reference: Date,
): CompetitionSeed {
  const referenceDay = reference.getUTCDay();
  const daysUntilMonday = referenceDay === 1 ? 7 : (8 - referenceDay) % 7;
  const tradingStartsAt = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate() + daysUntilMonday,
    ),
  );
  const tradingEndsAt = new Date(tradingStartsAt.getTime() + 5 * dayMs - 1);
  const dateCode = tradingStartsAt
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '');

  return {
    code: `DEV-WEEK-${dateCode}`,
    name: `Weekly Competition · ${tradingStartsAt.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })}`,
    rulesVersion: 1,
    signupClosesAt: new Date(tradingStartsAt.getTime() - 60 * 60 * 1000),
    status: 'SCHEDULED',
    timezone: 'UTC',
    tradingEndsAt,
    tradingStartsAt,
  };
}
