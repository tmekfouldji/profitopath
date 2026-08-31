import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  cancelCompetitionDraft,
  createChallengeTier,
  createCompetitionDraft,
  publishCompetitionDraft,
  setChallengeTierAvailability,
  setManagedUserRole,
  transitionManagedUserStatus,
  updateUnusedChallengeTier,
} from './admin-service';

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const fixtures: Array<{
  competitionIds: string[];
  ownerId: string;
  tierId: string;
  userId: string;
}> = [];

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { actorUserId: fixture.ownerId },
          { entityId: fixture.tierId },
          { entityId: { in: fixture.competitionIds } },
          { entityId: fixture.userId },
        ],
      },
    });
    await database.competition.deleteMany({
      where: { id: { in: fixture.competitionIds } },
    });
    await database.challengeTier.delete({ where: { id: fixture.tierId } });
    await database.user.deleteMany({
      where: { id: { in: [fixture.ownerId, fixture.userId] } },
    });
  }
});

integrationTest('superadmin setup services', () => {
  it('keeps tier and draft changes audited while allowing safe operational toggles', async () => {
    const suffix = crypto.randomUUID();
    const owner = await database.user.create({
      data: { email: `owner-${suffix}@example.test`, role: 'SUPERADMIN' },
    });
    const member = await database.user.create({
      data: { email: `member-${suffix}@example.test` },
    });
    const tier = await createChallengeTier({
      actorUserId: owner.id,
      code: `OPS-${suffix.slice(0, 8)}`,
      entryFeeMinor: 1_000,
      maxDrawdownMinor: 100_000n,
      name: 'Operations tier',
      performanceBenchmarkMinor: 200_000n,
      rulesVersion: 1,
      startingBalanceMinor: 1_000_000n,
    });
    const competition = await createCompetitionDraft({
      actorUserId: owner.id,
      code: `OPS-WEEK-${suffix}`,
      name: 'Operations Weekly',
      rulesVersion: 1,
      signupClosesAt: new Date('2027-01-05T20:00:00.000Z'),
      tradingEndsAt: new Date('2027-01-08T21:00:00.000Z'),
      tradingStartsAt: new Date('2027-01-04T00:00:00.000Z'),
    });
    const cancelledDraft = await createCompetitionDraft({
      actorUserId: owner.id,
      code: `OPS-CANCEL-${suffix}`,
      name: 'Cancelled Operations Weekly',
      rulesVersion: 1,
      signupClosesAt: new Date('2027-01-10T20:00:00.000Z'),
      tradingEndsAt: new Date('2027-01-15T21:00:00.000Z'),
      tradingStartsAt: new Date('2027-01-11T00:00:00.000Z'),
    });
    await expect(
      createCompetitionDraft({
        actorUserId: owner.id,
        code: `OPS-INVALID-${suffix}`,
        name: 'Invalid signup window',
        rulesVersion: 1,
        signupClosesAt: new Date('2027-01-09T00:00:00.000Z'),
        tradingEndsAt: new Date('2027-01-08T21:00:00.000Z'),
        tradingStartsAt: new Date('2027-01-04T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Signup must close no later than trading ends');
    fixtures.push({
      competitionIds: [competition.id, cancelledDraft.id],
      ownerId: owner.id,
      tierId: tier.id,
      userId: member.id,
    });

    await updateUnusedChallengeTier({
      actorUserId: owner.id,
      entryFeeMinor: 1_500,
      maxDrawdownMinor: 120_000n,
      name: 'Operations tier revised',
      performanceBenchmarkMinor: 250_000n,
      rulesVersion: 2,
      startingBalanceMinor: 1_000_000n,
      tierId: tier.id,
    });
    await setChallengeTierAvailability({
      active: false,
      actorUserId: owner.id,
      reason: 'Pause new preorder purchases',
      tierId: tier.id,
    });
    await setChallengeTierAvailability({
      active: true,
      actorUserId: owner.id,
      reason: 'Resume new preorder purchases',
      tierId: tier.id,
    });
    await publishCompetitionDraft({
      actorUserId: owner.id,
      competitionId: competition.id,
    });
    await cancelCompetitionDraft({
      actorUserId: owner.id,
      competitionId: cancelledDraft.id,
      reason: 'Duplicate draft removed before publication',
    });

    await setManagedUserRole({
      actorUserId: owner.id,
      role: 'ADMIN',
      userId: member.id,
    });
    await setManagedUserRole({
      actorUserId: owner.id,
      role: 'TRADER',
      userId: member.id,
    });
    await transitionManagedUserStatus({
      actorUserId: owner.id,
      reason: 'Test suspension evidence',
      status: 'SUSPENDED',
      userId: member.id,
    });
    await transitionManagedUserStatus({
      actorUserId: owner.id,
      reason: 'Test restoration evidence',
      status: 'ACTIVE',
      userId: member.id,
    });

    const [storedTier, storedCompetition, storedCancelledDraft, storedMember] =
      await Promise.all([
        database.challengeTier.findUniqueOrThrow({ where: { id: tier.id } }),
        database.competition.findUniqueOrThrow({
          where: { id: competition.id },
        }),
        database.competition.findUniqueOrThrow({
          where: { id: cancelledDraft.id },
        }),
        database.user.findUniqueOrThrow({ where: { id: member.id } }),
      ]);
    expect(storedTier).toMatchObject({
      active: true,
      entryFeeMinor: 1_500,
      name: 'Operations tier revised',
      rulesVersion: 2,
    });
    expect(storedCompetition.status).toBe('SCHEDULED');
    expect(storedCancelledDraft.status).toBe('CANCELLED');
    expect(storedMember).toMatchObject({ role: 'TRADER', status: 'ACTIVE' });
    await expect(
      database.auditEvent.count({
        where: { actorUserId: owner.id },
      }),
    ).resolves.toBeGreaterThanOrEqual(10);
  });
});
