import 'server-only';

import { createHash } from 'node:crypto';

import { database } from '@profitopath/database';
import {
  createLogger,
  createValkeyClient,
  parseRuntimeEnv,
} from '@profitopath/shared';

const logger = createLogger({ service: 'web-observability', version: '0.1.0' });
const onlineMemberKey = 'presence:members:v1';
const onlineMemberWindowMs = 5 * 60 * 1000;

let valkey: ReturnType<typeof createValkeyClient> | undefined;

export const siteVisitorCookie = 'profitopath_visitor';

export function hashAnonymousVisitor(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex');
}

export function utcCalendarDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function normalizeVisitedPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/';
  }

  const path = value.split(/[?#]/, 1)[0] ?? '/';
  if (path.startsWith('//')) {
    return '/';
  }

  return path.slice(0, 255) || '/';
}

export async function recordDailyWebsiteVisit(input: {
  anonymousVisitorId: string;
  path: unknown;
  visitedAt?: Date;
}): Promise<void> {
  const visitedAt = input.visitedAt ?? new Date();
  await database.websiteVisit.upsert({
    create: {
      entryPath: normalizeVisitedPath(input.path),
      visitDay: utcCalendarDay(visitedAt),
      visitorHash: hashAnonymousVisitor(input.anonymousVisitorId),
    },
    update: {},
    where: {
      visitorHash_visitDay: {
        visitDay: utcCalendarDay(visitedAt),
        visitorHash: hashAnonymousVisitor(input.anonymousVisitorId),
      },
    },
  });
}

function configuredValkey(): ReturnType<typeof createValkeyClient> {
  if (valkey !== undefined) {
    return valkey;
  }

  const env = parseRuntimeEnv();
  valkey = createValkeyClient(env.VALKEY_URL, (error) => {
    logger.warn({ error }, 'Member-presence Valkey connection error');
  });
  return valkey;
}

async function ensureValkeyReady(
  client: ReturnType<typeof createValkeyClient>,
): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
  if (client.status !== 'ready') {
    throw new Error(`Member-presence Valkey is ${client.status}`);
  }
}

export async function recordActiveMember(userId: string): Promise<void> {
  try {
    const client = configuredValkey();
    await ensureValkeyReady(client);
    await client.zadd(onlineMemberKey, Date.now(), `user:${userId}`);
  } catch (error) {
    logger.warn({ error }, 'Unable to update active member presence');
  }
}

export async function getActiveMemberCount(): Promise<number | null> {
  try {
    const client = configuredValkey();
    await ensureValkeyReady(client);
    await client.zremrangebyscore(
      onlineMemberKey,
      '-inf',
      Date.now() - onlineMemberWindowMs,
    );
    return await client.zcard(onlineMemberKey);
  } catch (error) {
    logger.warn({ error }, 'Unable to read active member presence');
    return null;
  }
}

export function configurationHealth(input: {
  emailProvider: 'console' | 'smtp';
  marketDataSource: 'mock';
  mockMarketDataEnabled: boolean;
  nowPaymentsApiKeyConfigured: boolean;
  nowPaymentsIpnSecretConfigured: boolean;
  paymentProvider: 'mock' | 'nowpayments';
  publicOrigin: string;
}) {
  const nowPaymentsConfigured =
    input.nowPaymentsApiKeyConfigured && input.nowPaymentsIpnSecretConfigured;
  return {
    email:
      input.emailProvider === 'smtp'
        ? 'SMTP verification enabled'
        : 'SMTP verification not configured',
    emailProvider: input.emailProvider,
    marketData: input.mockMarketDataEnabled
      ? 'Mock feed enabled'
      : 'Mock feed held',
    marketDataSource: input.marketDataSource,
    nowPayments: nowPaymentsConfigured
      ? input.paymentProvider === 'nowpayments'
        ? 'Live checkout enabled'
        : 'Credentials ready — mock checkout active'
      : 'Credentials missing — mock checkout active',
    paymentProvider: input.paymentProvider,
    publicOrigin: input.publicOrigin,
  };
}

export function getConfigurationHealth() {
  const env = parseRuntimeEnv();
  return configurationHealth({
    emailProvider: env.EMAIL_PROVIDER,
    marketDataSource: env.MARKET_DATA_SOURCE,
    mockMarketDataEnabled: env.MOCK_MARKET_DATA_ENABLED,
    nowPaymentsApiKeyConfigured: env.NOWPAYMENTS_API_KEY !== undefined,
    nowPaymentsIpnSecretConfigured: env.NOWPAYMENTS_IPN_SECRET !== undefined,
    paymentProvider: env.PAYMENT_PROVIDER,
    publicOrigin: env.NEXTAUTH_URL,
  });
}
