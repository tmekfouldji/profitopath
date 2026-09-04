import { createServer } from 'node:http';

import { checkDatabase, database } from '@profitopath/database';
import {
  checkValkey,
  createLogger,
  createValkeyClient,
  runReadinessChecks,
  serviceEnvSchema,
} from '@profitopath/shared';
import { config } from 'dotenv';
import { getToken } from 'next-auth/jwt';
import { WebSocket, WebSocketServer } from 'ws';

import {
  parseAccountStateDelta,
  parseCandleDelta,
  parseQuoteDelta,
} from './protocol';

config({ path: '../../.env', quiet: true });

const env = serviceEnvSchema.parse({
  ...process.env,
  PORT: process.env.REALTIME_PORT ?? 3001,
});
const logger = createLogger({ service: 'realtime', version: '0.1.0' });
const valkey = createValkeyClient(env.VALKEY_URL, (error) => {
  logger.warn({ error }, 'Valkey connection error');
});
const quoteSubscriber = valkey.duplicate();
quoteSubscriber.on('error', (error) => {
  logger.warn({ error }, 'Realtime quote subscriber error');
});

interface SocketContext {
  accountId: string;
  userId: string;
}

const sockets = new Map<WebSocket, SocketContext>();
const websocketServer = new WebSocketServer({ noServer: true });
const authorizationRevalidationIntervalMs = 60_000;

function canReceiveTrialMarketData(role: unknown): boolean {
  return (
    env.MARKET_DATA_SOURCE !== 'twelve-data-trial' ||
    role === 'ADMIN' ||
    role === 'SUPERADMIN'
  );
}

function requestCookies(header: string | undefined): Record<string, string> {
  if (header === undefined) {
    return {};
  }
  return Object.fromEntries(
    header.split(';').flatMap((part) => {
      const separator = part.indexOf('=');
      if (separator < 1) {
        return [];
      }
      return [
        [
          part.slice(0, separator).trim(),
          decodeURIComponent(part.slice(separator + 1).trim()),
        ],
      ];
    }),
  );
}

async function accountSnapshot(accountId: string, userId: string) {
  const account = await database.tradingAccount.findFirst({
    include: {
      orders: {
        orderBy: { submittedAt: 'desc' },
        take: 100,
        where: { status: { in: ['ACCEPTED', 'PARTIALLY_FILLED'] } },
      },
      positions: { where: { status: 'OPEN' } },
      snapshots: { orderBy: { sequence: 'desc' }, take: 1 },
    },
    where: { competitionEntry: { userId }, id: accountId },
  });
  if (account === null) {
    return null;
  }
  const snapshot = account.snapshots[0];
  return {
    account: {
      balanceMinor: account.balanceMinor.toString(),
      id: account.id,
      status: account.status,
    },
    kind: 'snapshot' as const,
    orders: account.orders.map((order) => ({
      id: order.id,
      quantity: order.quantity.toString(),
      side: order.side,
      status: order.status,
      symbol: order.symbol,
      type: order.type,
    })),
    positions: account.positions.map((position) => ({
      averageEntryPrice: position.averageEntryPrice.toString(),
      id: position.id,
      quantity: position.quantity.toString(),
      side: position.side,
      symbol: position.symbol,
    })),
    risk: {
      equityMinor:
        snapshot?.equityMinor.toString() ?? account.balanceMinor.toString(),
      marginFreeMinor:
        snapshot?.marginFreeMinor.toString() ?? account.balanceMinor.toString(),
      marginUsedMinor: snapshot?.marginUsedMinor.toString() ?? '0',
      unrealizedPnlMinor: snapshot?.unrealizedPnlMinor.toString() ?? '0',
    },
    version: snapshot?.sequence.toString() ?? '0',
  };
}

async function sendSnapshot(socket: WebSocket, context: SocketContext) {
  const snapshot = await accountSnapshot(context.accountId, context.userId);
  if (snapshot === null) {
    socket.close(4404, 'Account not found');
    return;
  }
  socket.send(JSON.stringify(snapshot));
}

async function revalidateSocketAuthorizations(): Promise<void> {
  const activeSockets = [...sockets.entries()];
  if (activeSockets.length === 0) {
    return;
  }

  const activeAccountIds = new Set(
    (
      await database.tradingAccount.findMany({
        select: { id: true },
        where: {
          id: {
            in: [
              ...new Set(activeSockets.map(([, context]) => context.accountId)),
            ],
          },
          competitionEntry: {
            user: {
              ...(env.MARKET_DATA_SOURCE === 'twelve-data-trial'
                ? { role: { in: ['ADMIN', 'SUPERADMIN'] } }
                : {}),
              status: 'ACTIVE',
            },
          },
        },
      })
    ).map((account) => account.id),
  );

  for (const [socket, context] of activeSockets) {
    if (!activeAccountIds.has(context.accountId)) {
      socket.close(4401, 'Session no longer authorized');
    }
  }
}

const authorizationRevalidationTimer = setInterval(() => {
  void revalidateSocketAuthorizations().catch((error: unknown) => {
    logger.warn({ error }, 'Realtime authorization revalidation failed');
  });
}, authorizationRevalidationIntervalMs);
authorizationRevalidationTimer.unref();

websocketServer.on('connection', (socket) => {
  const context = sockets.get(socket);
  if (context === undefined) {
    socket.close(4401, 'Unauthorized');
    return;
  }
  void sendSnapshot(socket, context);
  socket.on('message', (message) => {
    if (message.toString() === 'resync') {
      void sendSnapshot(socket, context);
    }
  });
  socket.on('close', () => sockets.delete(socket));
});

const server = createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');

  if (request.url === '/health/live') {
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.url === '/health/ready') {
    const report = await runReadinessChecks({
      database: checkDatabase,
      valkey: () => checkValkey(valkey),
    });
    response.statusCode = report.status === 'ok' ? 200 : 503;
    response.end(JSON.stringify(report));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.on('upgrade', async (request, socket, head) => {
  try {
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== new URL(env.NEXTAUTH_URL).origin) {
      socket.destroy();
      return;
    }
    const requestUrl = new URL(request.url ?? '/', env.NEXTAUTH_URL);
    const accountId = requestUrl.searchParams.get('accountId');
    const authRequest = Object.assign(request, {
      cookies: requestCookies(request.headers.cookie),
    });
    const token = await getToken({
      req: authRequest,
      secret: env.NEXTAUTH_SECRET,
    });
    if (
      accountId === null ||
      token?.sub === undefined ||
      token.status !== 'ACTIVE' ||
      !canReceiveTrialMarketData(token.role)
    ) {
      socket.destroy();
      return;
    }
    const account = await database.tradingAccount.findFirst({
      select: { id: true },
      where: {
        competitionEntry: {
          user: {
            ...(env.MARKET_DATA_SOURCE === 'twelve-data-trial'
              ? { role: { in: ['ADMIN', 'SUPERADMIN'] } }
              : {}),
            status: 'ACTIVE',
          },
          userId: token.sub,
        },
        id: accountId,
      },
    });
    if (account === null) {
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      sockets.set(websocket, { accountId, userId: token.sub! });
      websocketServer.emit('connection', websocket, request);
    });
  } catch (error) {
    logger.warn({ error }, 'Realtime upgrade rejected');
    socket.destroy();
  }
});

await quoteSubscriber.connect();
await quoteSubscriber.subscribe(
  'market:quotes:v1',
  'market:candles:v1',
  'market:accounts:v1',
);
quoteSubscriber.on('message', (channel, message) => {
  const delta =
    channel === 'market:candles:v1'
      ? parseCandleDelta(message)
      : channel === 'market:accounts:v1'
        ? parseAccountStateDelta(message)
        : parseQuoteDelta(message);
  if (delta === null) {
    return;
  }
  const envelope = JSON.stringify({
    ...delta,
    accountState: 'RESYNC_REQUIRED',
  });
  for (const socket of sockets.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(envelope);
    }
  }
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Realtime service listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Realtime service shutting down');
  server.close();
  for (const socket of sockets.keys()) {
    socket.close(1001, 'Service shutdown');
  }
  websocketServer.close();
  clearInterval(authorizationRevalidationTimer);
  quoteSubscriber.disconnect();
  valkey.disconnect();
  await database.$disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
