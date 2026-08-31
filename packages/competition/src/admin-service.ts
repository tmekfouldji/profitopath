import { database, type Prisma, type UserRole } from '@profitopath/database';

import {
  assertStateTransition,
  competitionEntryTransitions,
  competitionTransitions,
  orderTransitions,
  tradingAccountTransitions,
  userTransitions,
} from './state-machine';

export class CompetitionAdminCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompetitionAdminCommandError';
  }
}

function requiredReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 3) {
    throw new CompetitionAdminCommandError(
      'An administrative reason of at least 3 characters is required',
    );
  }
  if (normalized.length > 1000) {
    throw new CompetitionAdminCommandError(
      'Administrative reason cannot exceed 1000 characters',
    );
  }
  return normalized;
}

function requiredText(input: string, label: string, maximum: number): string {
  const normalized = input.trim();
  if (normalized.length === 0) {
    throw new CompetitionAdminCommandError(`${label} is required`);
  }
  if (normalized.length > maximum) {
    throw new CompetitionAdminCommandError(
      `${label} cannot exceed ${maximum} characters`,
    );
  }
  return normalized;
}

function requiredCode(input: string, label: string, maximum: number): string {
  const code = requiredText(input, label, maximum).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
    throw new CompetitionAdminCommandError(
      `${label} must use only uppercase letters, numbers, hyphens, and underscores`,
    );
  }
  return code;
}

function requiredPositiveInteger(input: number, label: string): number {
  if (!Number.isSafeInteger(input) || input < 1) {
    throw new CompetitionAdminCommandError(
      `${label} must be a positive integer`,
    );
  }
  return input;
}

function requiredMinorAmount(input: bigint, label: string): bigint {
  if (input < 0n) {
    throw new CompetitionAdminCommandError(`${label} cannot be negative`);
  }
  return input;
}

function assertFutureCompetitionWindow(input: {
  signupClosesAt: Date;
  tradingEndsAt: Date;
  tradingStartsAt: Date;
}): void {
  const { signupClosesAt, tradingEndsAt, tradingStartsAt } = input;
  if (
    Number.isNaN(signupClosesAt.getTime()) ||
    Number.isNaN(tradingStartsAt.getTime()) ||
    Number.isNaN(tradingEndsAt.getTime())
  ) {
    throw new CompetitionAdminCommandError(
      'Competition timestamps are invalid',
    );
  }
  if (tradingStartsAt >= tradingEndsAt) {
    throw new CompetitionAdminCommandError('Trading must end after it starts');
  }
  if (signupClosesAt > tradingEndsAt) {
    throw new CompetitionAdminCommandError(
      'Signup must close no later than trading ends',
    );
  }
}

function assertPublishableCompetitionWindow(input: {
  signupClosesAt: Date;
  tradingEndsAt: Date;
  tradingStartsAt: Date;
}): void {
  assertFutureCompetitionWindow(input);
  const now = new Date();
  if (input.signupClosesAt <= now || input.tradingStartsAt <= now) {
    throw new CompetitionAdminCommandError(
      'A preorder competition must have a future signup-close and trading-start time',
    );
  }
}

async function lockCompetition(
  transaction: Prisma.TransactionClient,
  competitionId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`competition-lifecycle:${competitionId}`}, 0)
    )
  `;
}

async function lockTradingAccount(
  transaction: Prisma.TransactionClient,
  accountId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`simulator:${accountId}`}, 0))
  `;
}

async function lockChallengeTier(
  transaction: Prisma.TransactionClient,
  tierId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`challenge-tier:${tierId}`}, 0)
    )
  `;
}

async function lockManagedUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`managed-user:${userId}`}, 0))
  `;
}

export interface CreateChallengeTierInput {
  actorUserId: string;
  code: string;
  entryFeeMinor: number;
  maxDrawdownMinor: bigint;
  name: string;
  performanceBenchmarkMinor: bigint;
  rulesVersion: number;
  startingBalanceMinor: bigint;
}

export async function createChallengeTier(
  input: CreateChallengeTierInput,
): Promise<{ id: string }> {
  const code = requiredCode(input.code, 'Tier code', 32);
  const name = requiredText(input.name, 'Tier name', 80);
  const entryFeeMinor = requiredPositiveInteger(
    input.entryFeeMinor,
    'Entry fee',
  );
  const rulesVersion = requiredPositiveInteger(
    input.rulesVersion,
    'Rules version',
  );
  const maxDrawdownMinor = requiredMinorAmount(
    input.maxDrawdownMinor,
    'Maximum drawdown',
  );
  const performanceBenchmarkMinor = requiredMinorAmount(
    input.performanceBenchmarkMinor,
    'Performance benchmark',
  );
  const startingBalanceMinor = requiredMinorAmount(
    input.startingBalanceMinor,
    'Starting balance',
  );
  if (startingBalanceMinor === 0n) {
    throw new CompetitionAdminCommandError(
      'Starting balance must be greater than zero',
    );
  }
  if (maxDrawdownMinor > startingBalanceMinor) {
    throw new CompetitionAdminCommandError(
      'Maximum drawdown cannot exceed the simulated starting balance',
    );
  }

  return database.$transaction(async (transaction) => {
    const existing = await transaction.challengeTier.findUnique({
      select: { id: true },
      where: { code },
    });
    if (existing !== null) {
      throw new CompetitionAdminCommandError('A tier already uses this code');
    }
    const tier = await transaction.challengeTier.create({
      data: {
        active: true,
        code,
        currency: 'USD',
        entryFeeMinor,
        maxDrawdownMinor,
        name,
        performanceBenchmarkMinor,
        rulesVersion,
        startingBalanceMinor,
      },
      select: { id: true },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'CHALLENGE_TIER_CREATED',
        actorUserId: input.actorUserId,
        after: {
          active: true,
          code,
          currency: 'USD',
          entryFeeMinor,
          maxDrawdownMinor: maxDrawdownMinor.toString(),
          name,
          performanceBenchmarkMinor: performanceBenchmarkMinor.toString(),
          rulesVersion,
          startingBalanceMinor: startingBalanceMinor.toString(),
        },
        correlationId: `tier-create:${tier.id}`,
        entityId: tier.id,
        entityType: 'ChallengeTier',
        idempotencyKey: `audit:tier:${tier.id}:created:v1`,
        reason: 'Superadmin created a versioned simulated competition tier',
      },
    });
    return tier;
  });
}

export async function setChallengeTierAvailability(input: {
  active: boolean;
  actorUserId: string;
  reason: string;
  tierId: string;
}): Promise<{ alreadySet: boolean }> {
  const reason = requiredReason(input.reason);
  return database.$transaction(async (transaction) => {
    await lockChallengeTier(transaction, input.tierId);
    const tier = await transaction.challengeTier.findUniqueOrThrow({
      where: { id: input.tierId },
    });
    if (tier.active === input.active) return { alreadySet: true };
    await transaction.challengeTier.update({
      data: { active: input.active },
      where: { id: tier.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'CHALLENGE_TIER_AVAILABILITY_CHANGED',
        actorUserId: input.actorUserId,
        after: { active: input.active },
        before: { active: tier.active },
        correlationId: `tier-availability:${tier.id}:${input.active ? 'on' : 'off'}`,
        entityId: tier.id,
        entityType: 'ChallengeTier',
        reason,
      },
    });
    return { alreadySet: false };
  });
}

export async function updateUnusedChallengeTier(input: {
  actorUserId: string;
  entryFeeMinor: number;
  maxDrawdownMinor: bigint;
  name: string;
  performanceBenchmarkMinor: bigint;
  rulesVersion: number;
  startingBalanceMinor: bigint;
  tierId: string;
}): Promise<void> {
  const name = requiredText(input.name, 'Tier name', 80);
  const entryFeeMinor = requiredPositiveInteger(
    input.entryFeeMinor,
    'Entry fee',
  );
  const rulesVersion = requiredPositiveInteger(
    input.rulesVersion,
    'Rules version',
  );
  const maxDrawdownMinor = requiredMinorAmount(
    input.maxDrawdownMinor,
    'Maximum drawdown',
  );
  const performanceBenchmarkMinor = requiredMinorAmount(
    input.performanceBenchmarkMinor,
    'Performance benchmark',
  );
  const startingBalanceMinor = requiredMinorAmount(
    input.startingBalanceMinor,
    'Starting balance',
  );
  if (startingBalanceMinor === 0n) {
    throw new CompetitionAdminCommandError(
      'Starting balance must be greater than zero',
    );
  }
  if (maxDrawdownMinor > startingBalanceMinor) {
    throw new CompetitionAdminCommandError(
      'Maximum drawdown cannot exceed the simulated starting balance',
    );
  }

  return database.$transaction(async (transaction) => {
    await lockChallengeTier(transaction, input.tierId);
    const tier = await transaction.challengeTier.findUniqueOrThrow({
      include: { _count: { select: { entries: true } } },
      where: { id: input.tierId },
    });
    if (tier._count.entries !== 0) {
      throw new CompetitionAdminCommandError(
        'This tier has entries and is immutable; create a new version instead',
      );
    }
    await transaction.challengeTier.update({
      data: {
        entryFeeMinor,
        maxDrawdownMinor,
        name,
        performanceBenchmarkMinor,
        rulesVersion,
        startingBalanceMinor,
      },
      where: { id: tier.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'CHALLENGE_TIER_UPDATED',
        actorUserId: input.actorUserId,
        after: {
          entryFeeMinor,
          maxDrawdownMinor: maxDrawdownMinor.toString(),
          name,
          performanceBenchmarkMinor: performanceBenchmarkMinor.toString(),
          rulesVersion,
          startingBalanceMinor: startingBalanceMinor.toString(),
        },
        before: {
          entryFeeMinor: tier.entryFeeMinor,
          maxDrawdownMinor: tier.maxDrawdownMinor.toString(),
          name: tier.name,
          performanceBenchmarkMinor: tier.performanceBenchmarkMinor.toString(),
          rulesVersion: tier.rulesVersion,
          startingBalanceMinor: tier.startingBalanceMinor.toString(),
        },
        correlationId: `tier-update:${tier.id}`,
        entityId: tier.id,
        entityType: 'ChallengeTier',
        reason:
          'Superadmin updated an unused simulated competition tier configuration',
      },
    });
  });
}

export interface CreateCompetitionDraftInput {
  actorUserId: string;
  code: string;
  name: string;
  rulesVersion: number;
  signupClosesAt: Date;
  tradingEndsAt: Date;
  tradingStartsAt: Date;
}

export async function createCompetitionDraft(
  input: CreateCompetitionDraftInput,
): Promise<{ id: string }> {
  const code = requiredCode(input.code, 'Competition code', 64);
  const name = requiredText(input.name, 'Competition name', 120);
  const rulesVersion = requiredPositiveInteger(
    input.rulesVersion,
    'Rules version',
  );
  assertFutureCompetitionWindow(input);

  return database.$transaction(async (transaction) => {
    const existing = await transaction.competition.findUnique({
      select: { id: true },
      where: { code },
    });
    if (existing !== null) {
      throw new CompetitionAdminCommandError(
        'A competition already uses this code',
      );
    }
    const competition = await transaction.competition.create({
      data: {
        code,
        name,
        rulesVersion,
        signupClosesAt: input.signupClosesAt,
        status: 'DRAFT',
        timezone: 'UTC',
        tradingEndsAt: input.tradingEndsAt,
        tradingStartsAt: input.tradingStartsAt,
      },
      select: { id: true },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'COMPETITION_DRAFT_CREATED',
        actorUserId: input.actorUserId,
        after: {
          code,
          name,
          rulesVersion,
          signupClosesAt: input.signupClosesAt.toISOString(),
          status: 'DRAFT',
          timezone: 'UTC',
          tradingEndsAt: input.tradingEndsAt.toISOString(),
          tradingStartsAt: input.tradingStartsAt.toISOString(),
        },
        correlationId: `competition-draft:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:draft-created:v1`,
        reason: 'Superadmin created a future UTC competition draft',
      },
    });
    return competition;
  });
}

export async function updateCompetitionDraft(input: {
  actorUserId: string;
  competitionId: string;
  name: string;
  rulesVersion: number;
  signupClosesAt: Date;
  tradingEndsAt: Date;
  tradingStartsAt: Date;
}): Promise<void> {
  const name = requiredText(input.name, 'Competition name', 120);
  const rulesVersion = requiredPositiveInteger(
    input.rulesVersion,
    'Rules version',
  );
  assertFutureCompetitionWindow(input);
  await database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      where: { id: input.competitionId },
    });
    if (competition.status !== 'DRAFT') {
      throw new CompetitionAdminCommandError(
        'Only an unpublished draft can be edited',
      );
    }
    await transaction.competition.update({
      data: {
        name,
        rulesVersion,
        signupClosesAt: input.signupClosesAt,
        tradingEndsAt: input.tradingEndsAt,
        tradingStartsAt: input.tradingStartsAt,
      },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'COMPETITION_DRAFT_UPDATED',
        actorUserId: input.actorUserId,
        after: {
          name,
          rulesVersion,
          signupClosesAt: input.signupClosesAt.toISOString(),
          tradingEndsAt: input.tradingEndsAt.toISOString(),
          tradingStartsAt: input.tradingStartsAt.toISOString(),
        },
        before: {
          name: competition.name,
          rulesVersion: competition.rulesVersion,
          signupClosesAt: competition.signupClosesAt.toISOString(),
          tradingEndsAt: competition.tradingEndsAt.toISOString(),
          tradingStartsAt: competition.tradingStartsAt.toISOString(),
        },
        correlationId: `competition-draft-update:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:draft-updated:${competition.updatedAt.getTime()}`,
        reason:
          'Superadmin updated an unpublished future UTC competition draft',
      },
    });
  });
}

export async function publishCompetitionDraft(input: {
  actorUserId: string;
  competitionId: string;
}): Promise<void> {
  await database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const [competition, activeTierCount] = await Promise.all([
      transaction.competition.findUniqueOrThrow({
        where: { id: input.competitionId },
      }),
      transaction.challengeTier.count({ where: { active: true } }),
    ]);
    if (competition.status !== 'DRAFT') {
      throw new CompetitionAdminCommandError(
        'Only an unpublished draft can be published for preorder',
      );
    }
    if (activeTierCount === 0) {
      throw new CompetitionAdminCommandError(
        'Create and activate at least one simulated tier before publishing preorder',
      );
    }
    assertPublishableCompetitionWindow(competition);
    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'SCHEDULED',
    );
    await transaction.competition.update({
      data: { status: 'SCHEDULED' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        actorUserId: input.actorUserId,
        after: { status: 'SCHEDULED' },
        before: { status: competition.status },
        correlationId: `competition-published:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:scheduled:v1`,
        reason:
          'Superadmin published a validated future UTC window for preorder',
      },
    });
  });
}

export async function cancelCompetitionDraft(input: {
  actorUserId: string;
  competitionId: string;
  reason: string;
}): Promise<void> {
  const reason = requiredReason(input.reason);
  await database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      include: { _count: { select: { entries: true } } },
      where: { id: input.competitionId },
    });
    if (competition.status !== 'DRAFT') {
      throw new CompetitionAdminCommandError(
        'Only an unpublished draft can be cancelled here',
      );
    }
    if (competition._count.entries !== 0) {
      throw new CompetitionAdminCommandError(
        'A draft with entries cannot be cancelled from the setup console',
      );
    }
    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'CANCELLED',
    );
    await transaction.competition.update({
      data: { status: 'CANCELLED' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        actorUserId: input.actorUserId,
        after: { status: 'CANCELLED' },
        before: { status: competition.status },
        correlationId: `competition-draft-cancel:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:cancelled:v1`,
        reason,
      },
    });
  });
}

export async function setManagedUserRole(input: {
  actorUserId: string;
  role: 'ADMIN' | 'TRADER';
  userId: string;
}): Promise<{ alreadySet: boolean }> {
  if (input.userId === input.actorUserId) {
    throw new CompetitionAdminCommandError(
      'Your own role cannot be changed from the control center',
    );
  }
  return database.$transaction(async (transaction) => {
    await lockManagedUser(transaction, input.userId);
    const user = await transaction.user.findUniqueOrThrow({
      where: { id: input.userId },
    });
    if (user.role === 'SUPERADMIN') {
      throw new CompetitionAdminCommandError(
        'Another superadmin role must be managed through the controlled host procedure',
      );
    }
    if (user.role === input.role) return { alreadySet: true };
    await transaction.user.update({
      data: { role: input.role as UserRole },
      where: { id: user.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'USER_ROLE_CHANGED',
        actorUserId: input.actorUserId,
        after: { role: input.role },
        before: { role: user.role },
        correlationId: `user-role:${user.id}:${input.role}`,
        entityId: user.id,
        entityType: 'User',
        reason: 'Superadmin changed an operational platform role',
      },
    });
    return { alreadySet: false };
  });
}

export async function transitionManagedUserStatus(input: {
  actorUserId: string;
  reason: string;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  userId: string;
}): Promise<{ alreadySet: boolean }> {
  const reason = requiredReason(input.reason);
  if (input.userId === input.actorUserId) {
    throw new CompetitionAdminCommandError(
      'Your own account status cannot be changed from the control center',
    );
  }
  return database.$transaction(async (transaction) => {
    await lockManagedUser(transaction, input.userId);
    const user = await transaction.user.findUniqueOrThrow({
      where: { id: input.userId },
    });
    if (user.role === 'SUPERADMIN') {
      throw new CompetitionAdminCommandError(
        'A superadmin account status must be managed through the controlled host procedure',
      );
    }
    if (user.status === input.status) return { alreadySet: true };
    assertStateTransition('User', userTransitions, user.status, input.status);
    await transaction.user.update({
      data: { status: input.status },
      where: { id: user.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        actorUserId: input.actorUserId,
        after: { status: input.status },
        before: { status: user.status },
        correlationId: `user-status:${user.id}:${input.status}`,
        entityId: user.id,
        entityType: 'User',
        reason,
      },
    });
    return { alreadySet: false };
  });
}

export async function archiveCompetition(input: {
  actorUserId: string;
  competitionId: string;
  reason: string;
}): Promise<{ alreadyArchived: boolean }> {
  const reason = requiredReason(input.reason);
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, input.competitionId);
    const competition = await transaction.competition.findUniqueOrThrow({
      where: { id: input.competitionId },
    });
    if (competition.status === 'ARCHIVED') return { alreadyArchived: true };
    assertStateTransition(
      'Competition',
      competitionTransitions,
      competition.status,
      'ARCHIVED',
    );
    await transaction.competition.update({
      data: { status: 'ARCHIVED' },
      where: { id: competition.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'STATE_TRANSITIONED',
        actorUserId: input.actorUserId,
        after: { status: 'ARCHIVED' },
        before: { status: competition.status },
        correlationId: `admin-archive:${competition.id}`,
        entityId: competition.id,
        entityType: 'Competition',
        idempotencyKey: `audit:competition:${competition.id}:archived:v1`,
        reason,
      },
    });
    return { alreadyArchived: false };
  });
}

export async function disqualifyCompetitionEntry(input: {
  actorUserId: string;
  disqualifiedAt?: Date;
  entryId: string;
  reason: string;
}): Promise<{ alreadyDisqualified: boolean; cancelledOrders: number }> {
  const reason = requiredReason(input.reason);
  const disqualifiedAt = input.disqualifiedAt ?? new Date();
  if (Number.isNaN(disqualifiedAt.getTime())) {
    throw new CompetitionAdminCommandError('Disqualification time is invalid');
  }
  const reference = await database.competitionEntry.findUniqueOrThrow({
    select: { competitionId: true },
    where: { id: input.entryId },
  });
  return database.$transaction(async (transaction) => {
    await lockCompetition(transaction, reference.competitionId);
    const entry = await transaction.competitionEntry.findUniqueOrThrow({
      include: {
        competition: { select: { status: true } },
        tradingAccount: {
          include: {
            orders: {
              orderBy: { id: 'asc' },
              where: { status: { in: ['ACCEPTED', 'PARTIALLY_FILLED'] } },
            },
          },
        },
      },
      where: { id: input.entryId },
    });
    if (entry.competitionId !== reference.competitionId) {
      throw new CompetitionAdminCommandError(
        'Competition entry changed during disqualification',
      );
    }
    if (
      entry.status === 'DISQUALIFIED' &&
      entry.tradingAccount?.status === 'DISQUALIFIED'
    ) {
      return { alreadyDisqualified: true, cancelledOrders: 0 };
    }
    if (!['ACTIVE', 'FROZEN'].includes(entry.competition.status)) {
      throw new CompetitionAdminCommandError(
        'Entries can only be disqualified before leaderboard finalization',
      );
    }
    if (entry.tradingAccount === null) {
      throw new CompetitionAdminCommandError(
        'A provisioned trading account is required for disqualification',
      );
    }
    await lockTradingAccount(transaction, entry.tradingAccount.id);
    assertStateTransition(
      'CompetitionEntry',
      competitionEntryTransitions,
      entry.status,
      'DISQUALIFIED',
    );
    assertStateTransition(
      'TradingAccount',
      tradingAccountTransitions,
      entry.tradingAccount.status,
      'DISQUALIFIED',
    );
    const correlationId = `entry-disqualification:${entry.id}`;
    for (const order of entry.tradingAccount.orders) {
      assertStateTransition(
        'Order',
        orderTransitions,
        order.status,
        'CANCELLED',
      );
      await transaction.order.update({
        data: {
          completedAt: disqualifiedAt,
          status: 'CANCELLED',
          terminalReason: 'Competition entry disqualified by administrator',
        },
        where: { id: order.id },
      });
      await transaction.auditEvent.create({
        data: {
          action: 'ORDER_CANCELLED_FOR_DISQUALIFICATION',
          actorUserId: input.actorUserId,
          after: { status: 'CANCELLED' },
          before: { status: order.status },
          correlationId,
          entityId: order.id,
          entityType: 'Order',
          idempotencyKey: `audit:order:${order.id}:entry-disqualified:v1`,
          reason,
        },
      });
    }
    await transaction.competitionEntry.update({
      data: { disqualifiedAt, status: 'DISQUALIFIED' },
      where: { id: entry.id },
    });
    await transaction.tradingAccount.update({
      data: { status: 'DISQUALIFIED' },
      where: { id: entry.tradingAccount.id },
    });
    await transaction.leaderboardScoreInput.updateMany({
      data: { eligibilityStatus: 'DISQUALIFIED' },
      where: { entryId: entry.id },
    });
    await transaction.auditEvent.createMany({
      data: [
        {
          action: 'ENTRY_DISQUALIFIED',
          actorUserId: input.actorUserId,
          after: {
            disqualifiedAt: disqualifiedAt.toISOString(),
            status: 'DISQUALIFIED',
          },
          before: { status: entry.status },
          correlationId,
          entityId: entry.id,
          entityType: 'CompetitionEntry',
          idempotencyKey: `audit:entry:${entry.id}:disqualified:v1`,
          reason,
        },
        {
          action: 'ACCOUNT_DISQUALIFIED',
          actorUserId: input.actorUserId,
          after: { status: 'DISQUALIFIED' },
          before: { status: entry.tradingAccount.status },
          correlationId,
          entityId: entry.tradingAccount.id,
          entityType: 'TradingAccount',
          idempotencyKey: `audit:account:${entry.tradingAccount.id}:disqualified:v1`,
          reason,
        },
      ],
    });
    return {
      alreadyDisqualified: false,
      cancelledOrders: entry.tradingAccount.orders.length,
    };
  });
}
