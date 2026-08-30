import 'server-only';

import { database } from '@profitopath/database';
import { getOwnedMockPayment as findOwnedMockPayment } from '@profitopath/payments';

import {
  getActiveMemberCount,
  getConfigurationHealth,
} from './site-observability';

export function listCompetitions() {
  return database.competition.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { tradingStartsAt: 'asc' },
    take: 20,
    where: { status: { in: ['SCHEDULED', 'ACTIVE', 'FROZEN', 'FINALIZED'] } },
  });
}

export function listActiveChallengeTiers() {
  return database.challengeTier.findMany({
    orderBy: [{ entryFeeMinor: 'asc' }, { code: 'asc' }],
    take: 3,
    where: { active: true },
  });
}

export async function getCompetition(id: string) {
  const [competition, tiers] = await Promise.all([
    database.competition.findFirst({
      include: { _count: { select: { entries: true } } },
      where: {
        id,
        status: { in: ['SCHEDULED', 'ACTIVE', 'FROZEN', 'FINALIZED'] },
      },
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

export function getTraderPrizeOverview(userId: string) {
  return database.prize.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      amountMinor: true,
      competition: { select: { code: true, name: true } },
      currency: true,
      freeEntryCredits: true,
      id: true,
      issuedFreeEntryCredits: {
        orderBy: { ordinal: 'asc' },
        select: { createdAt: true, id: true, ordinal: true, status: true },
      },
      kycStatus: true,
      payout: {
        select: {
          paidAt: true,
          reconciledAt: true,
          status: true,
        },
      },
      rank: true,
      status: true,
      tier: { select: { code: true, name: true } },
      winnerReviewStatus: true,
    },
    where: { winnerEntry: { userId } },
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

export function getOwnedMockPayment(providerPaymentId: string, userId: string) {
  return findOwnedMockPayment(providerPaymentId, userId);
}

export async function getAdminOverview() {
  const [
    users,
    competitions,
    activeAccounts,
    pendingPayments,
    recentPayments,
    recentAudit,
    managedCompetitions,
    prizeOperations,
  ] = await Promise.all([
    database.user.count(),
    database.competition.count(),
    database.tradingAccount.count({ where: { status: 'ACTIVE' } }),
    database.payment.count({
      where: { status: { in: ['CREATED', 'PENDING'] } },
    }),
    database.payment.findMany({
      include: {
        competitionEntry: {
          include: { tier: true, tradingAccount: true },
        },
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    database.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    database.competition.findMany({
      include: {
        entries: {
          include: {
            tier: { select: { code: true } },
            tradingAccount: { select: { status: true } },
            user: {
              select: { displayName: true, email: true, name: true },
            },
          },
          orderBy: [{ tier: { entryFeeMinor: 'asc' } }, { createdAt: 'asc' }],
        },
        finalization: { select: { resultHash: true } },
      },
      orderBy: { tradingStartsAt: 'desc' },
      take: 12,
      where: { status: { not: 'ARCHIVED' } },
    }),
    database.prize.findMany({
      include: {
        competition: { select: { code: true, name: true, status: true } },
        issuedFreeEntryCredits: {
          orderBy: { ordinal: 'asc' },
          select: { id: true, ordinal: true, status: true },
        },
        payout: true,
        tier: { select: { code: true, name: true } },
        winnerEntry: {
          include: {
            user: {
              select: { displayName: true, email: true, name: true },
            },
          },
        },
      },
      orderBy: [
        { competition: { tradingStartsAt: 'desc' } },
        { tier: { entryFeeMinor: 'asc' } },
        { rank: 'asc' },
      ],
      take: 40,
    }),
  ]);

  return {
    activeAccounts,
    competitions,
    managedCompetitions,
    pendingPayments,
    prizeOperations,
    recentAudit,
    recentPayments,
    users,
  };
}

function utcDaysAgo(days: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days),
  );
}

export async function getSuperadminOverview() {
  const thirtyDaysAgo = utcDaysAgo(29);
  const [
    activeAccounts,
    confirmedPaymentAggregate,
    connectedMembers,
    members,
    newMembersLast30Days,
    totalAccounts,
    uniqueVisitorsLast30Days,
  ] = await Promise.all([
    database.tradingAccount.count({ where: { status: 'ACTIVE' } }),
    database.payment.aggregate({
      _count: true,
      _sum: { amountMinor: true },
      where: { currency: 'USD', status: 'CONFIRMED' },
    }),
    getActiveMemberCount(),
    database.user.count(),
    database.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    database.tradingAccount.count(),
    database.websiteVisit.count({
      where: { visitDay: { gte: thirtyDaysAgo } },
    }),
  ]);

  return {
    activeAccounts,
    configuration: getConfigurationHealth(),
    confirmedPayments: confirmedPaymentAggregate._count,
    connectedMembers,
    confirmedRevenueMinor: confirmedPaymentAggregate._sum.amountMinor ?? 0,
    members,
    newMembersLast30Days,
    totalAccounts,
    uniqueVisitorsLast30Days,
  };
}

export function getSuperadminChallengeTiers() {
  return database.challengeTier.findMany({
    include: {
      _count: { select: { entries: true, prizes: true } },
    },
    orderBy: [{ active: 'desc' }, { entryFeeMinor: 'asc' }, { code: 'asc' }],
  });
}

export function getSuperadminCompetitionSetup() {
  return database.competition.findMany({
    include: {
      _count: { select: { entries: true, prizes: true } },
    },
    orderBy: { tradingStartsAt: 'asc' },
    where: { status: { in: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'FROZEN'] } },
  });
}

export async function getSuperadminUserDirectory(search: string) {
  const normalizedSearch = search.trim().slice(0, 100);
  const where =
    normalizedSearch.length === 0
      ? {}
      : {
          OR: [
            {
              email: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
            {
              displayName: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
            {
              name: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
          ],
        };
  const [members, total] = await Promise.all([
    database.user.findMany({
      include: {
        _count: { select: { entries: true, payments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      where,
    }),
    database.user.count({ where }),
  ]);
  return { members, normalizedSearch, total };
}

export async function getSuperadminPaymentLedger() {
  const [confirmedRevenue, payments, paymentCounts] = await Promise.all([
    database.payment.aggregate({
      _sum: { amountMinor: true },
      where: { currency: 'USD', status: 'CONFIRMED' },
    }),
    database.payment.findMany({
      include: {
        competitionEntry: {
          include: {
            competition: { select: { code: true, name: true } },
            tier: { select: { code: true, name: true } },
          },
        },
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    database.payment.groupBy({
      _count: { _all: true },
      by: ['status'],
    }),
  ]);
  return {
    confirmedRevenueMinor: confirmedRevenue._sum.amountMinor ?? 0,
    paymentCounts: Object.fromEntries(
      paymentCounts.map((record) => [record.status, record._count._all]),
    ),
    payments,
  };
}
