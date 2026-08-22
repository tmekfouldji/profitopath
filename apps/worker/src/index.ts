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

config({ path: '../../.env', quiet: true });

const env = serviceEnvSchema.parse({
  ...process.env,
  PORT: process.env.WORKER_PORT ?? 3002,
});
const logger = createLogger({ service: 'worker', version: '0.1.0' });
const valkey = createValkeyClient(env.VALKEY_URL, (error) => {
  logger.warn({ error }, 'Valkey connection error');
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
