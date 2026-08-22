import 'server-only';

import { database } from '@profitopath/database';

export function listCompetitions() {
  return database.competition.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { tradingStartsAt: 'asc' },
    take: 20,
    where: { status: { not: 'ARCHIVED' } },
  });
}

export async function getCompetition(id: string) {
  const [competition, tiers] = await Promise.all([
    database.competition.findUnique({
      include: { _count: { select: { entries: true } } },
      where: { id },
    }),
    database.challengeTier.findMany({
      orderBy: { entryFeeMinor: 'asc' },
      where: { active: true },
    }),
  ]);
  return { competition, tiers };
}

export function getTraderDashboard(userId: string) {
  return database.competitionEntry.findMany({
    include: {
      competition: true,
      tier: true,
      tradingAccount: true,
    },
    orderBy: { createdAt: 'desc' },
    where: { userId },
  });
}

export function getOwnedAccount(accountId: string, userId: string) {
  return database.tradingAccount.findFirst({
    include: {
      competitionEntry: {
        include: { competition: true, tier: true },
      },
    },
    where: {
      competitionEntry: { userId },
      id: accountId,
    },
  });
}

export async function getAdminOverview() {
  const [users, competitions, activeAccounts, pendingPayments, recentAudit] =
    await Promise.all([
      database.user.count(),
      database.competition.count(),
      database.tradingAccount.count({ where: { status: 'ACTIVE' } }),
      database.payment.count({
        where: { status: { in: ['CREATED', 'PENDING'] } },
      }),
      database.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

  return { activeAccounts, competitions, pendingPayments, recentAudit, users };
}
