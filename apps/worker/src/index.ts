import { createServer } from 'node:http';

import { checkDatabase, database } from '@profitopath/database';
import { MockMarketDataProvider } from '@profitopath/market-data';
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

if (env.MOCK_MARKET_DATA_ENABLED) {
  const mockProvider = new MockMarketDataProvider(
    createDevelopmentMockQuoteSeeds(new Date()),
  );
  const engine = new PersistentSimulatedExecutionEngine(mockProvider);
  const runtime = new MockSimulatorRuntime({
    processor: engine,
    provider: mockProvider,
    recover: recoverSimulatorState,
  });
  void runtime
    .run(['EURUSD', 'GBPUSD'])
    .then((result) => {
      logger.info(
        {
          processedQuotes: result.processedQuotes,
          recoveredAccounts: result.recovery.accounts.length,
        },
        'Deterministic mock market-data cycle completed',
      );
    })
    .catch((error: unknown) => {
      logger.error({ error }, 'Deterministic mock market-data cycle failed');
    });
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
  logger.info({ signal }, 'Worker service shutting down');
  server.close();
  valkey.disconnect();
  await database.$disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
