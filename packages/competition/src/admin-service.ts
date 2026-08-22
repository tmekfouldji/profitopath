import { database, type Prisma } from '@profitopath/database';

import {
  assertStateTransition,
  competitionEntryTransitions,
  competitionTransitions,
  orderTransitions,
  tradingAccountTransitions,
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
