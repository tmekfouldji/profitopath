import { createServer } from 'node:http';

import { checkDatabase, database } from '@profitopath/database';
import {
  LiveCandleProcessor,
  MockMarketDataProvider,
  ValkeyQuoteStore,
} from '@profitopath/market-data';
import {
  checkValkey,
  createLogger,
  createValkeyClient,
  runReadinessChecks,
  serviceEnvSchema,
} from '@profitopath/shared';
import {
  createDevelopmentMockQuoteSeeds,
  MockSimulatorRuntime,
  PersistentSimulatedExecutionEngine,
  isMarketOpen,
  recoverSimulatorState,
} from '@profitopath/simulator';
import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });

const env = serviceEnvSchema.parse({
  ...process.env,
  PORT: process.env.WORKER_PORT ?? 3002,
});
const logger = createLogger({ service: 'worker', version: '0.1.0' });
const valkey = createValkeyClient(env.VALKEY_URL, (error) => {
  logger.warn({ error }, 'Valkey connection error');
});

let mockCycleTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
if (env.MOCK_MARKET_DATA_ENABLED) {
  const candleProcessor = new LiveCandleProcessor(valkey);
  const quotePublisher = new ValkeyQuoteStore(valkey);
  let nextQuoteSequence = 1n;
  const runMockCycle = async () => {
    const reference = new Date();
    if (!isMarketOpen(reference, 'UTC_24X5')) {
      if (!shuttingDown) {
        mockCycleTimer = setTimeout(() => void runMockCycle(), 30_000);
      }
      return;
    }
    const seeds = createDevelopmentMockQuoteSeeds(
      reference,
      nextQuoteSequence > BigInt(reference.getTime()) * 10n
        ? nextQuoteSequence
        : BigInt(reference.getTime()) * 10n,
    );
    nextQuoteSequence = seeds.at(-1)!.sequence! + 1n;
    const mockProvider = new MockMarketDataProvider(seeds);
    const engine = new PersistentSimulatedExecutionEngine(mockProvider);
    mockProvider.onQuote(async (quote) => {
      await candleProcessor.process(quote);
    });
    const runtime = new MockSimulatorRuntime({
      processor: engine,
      provider: mockProvider,
      quotePublisher,
      recover: recoverSimulatorState,
    });
    try {
      const result = await runtime.run(['EURUSD', 'GBPUSD']);
      logger.info(
        {
          processedQuotes: result.processedQuotes,
          recoveredAccounts: result.recovery.accounts.length,
        },
        'Deterministic mock market-data cycle completed',
      );
    } catch (error: unknown) {
      logger.error({ error }, 'Deterministic mock market-data cycle failed');
    } finally {
      if (!shuttingDown) {
        mockCycleTimer = setTimeout(() => void runMockCycle(), 5_000);
      }
    }
  };
  void runMockCycle();
}

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

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Worker health server listening');
});

async function shutdown(signal: string): Promise<void> {
  shuttingDown = true;
  logger.info({ signal }, 'Worker service shutting down');
  server.close();
  if (mockCycleTimer !== null) {
    clearTimeout(mockCycleTimer);
  }
  valkey.disconnect();
  await database.$disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
