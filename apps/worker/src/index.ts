import { createServer } from 'node:http';

import {
  finalizeLeaderboard,
  processCompetitionLifecycle,
  recomputeFrozenLeaderboard,
  recomputeLiveLeaderboard,
} from '@profitopath/competition';
import { checkDatabase, database, type Prisma } from '@profitopath/database';
import {
  LiveCandleProcessor,
  MockMarketDataProvider,
  TwelveDataHistoricalBackfill,
  TwelveDataMarketDataProvider,
  TwelveDataPrivateProbe,
  ValkeyQuoteStore,
  twelveDataPrivateTestSymbols,
} from '@profitopath/market-data';
import {
  checkValkey,
  createLogger,
  createValkeyClient,
  runReadinessChecks,
  workerServiceEnvSchema,
} from '@profitopath/shared';
import {
  createDevelopmentMockQuoteSeeds,
  MockSimulatorRuntime,
  PersistentSimulatedExecutionEngine,
  isMarketOpen,
  recoverSimulatorState,
} from '@profitopath/simulator';
import { config } from 'dotenv';

import { CompetitionJobRunner } from './competition-jobs';
import { assertTwelveDataTrialInstrumentConfigurations } from './twelve-data-trial-configuration';
import { TwelveDataTrialRuntime } from './twelve-data-trial-runtime';
import {
  hasInternalMarketDataAuthorization,
  parseTrialBackfillRequest,
  TwelveDataTrialInternalApiError,
} from './twelve-data-trial-internal-api';

config({ path: '../../.env', quiet: true });

const env = workerServiceEnvSchema.parse({
  ...process.env,
  PORT: process.env.WORKER_PORT ?? 3002,
});
const logger = createLogger({ service: 'worker', version: '0.1.0' });
const valkey = createValkeyClient(env.VALKEY_URL, (error) => {
  logger.warn({ error }, 'Valkey connection error');
});

let mockCycleTimer: ReturnType<typeof setTimeout> | null = null;
let competitionJobTimer: ReturnType<typeof setTimeout> | null = null;
let twelveDataPrivateProbeTimer: ReturnType<typeof setTimeout> | null = null;
let twelveDataTrialRuntime: TwelveDataTrialRuntime | null = null;
let twelveDataTrialHistoricalBackfill: TwelveDataHistoricalBackfill | null =
  null;
let shuttingDown = false;

if (env.COMPETITION_JOBS_ENABLED) {
  const competitionJobs = new CompetitionJobRunner({
    autoFinalize: env.AUTO_FINALIZE_FROZEN_COMPETITIONS,
    services: {
      discover: async () => {
        const competitions = await database.competition.findMany({
          orderBy: [{ tradingEndsAt: 'asc' }, { id: 'asc' }],
          select: { id: true, status: true },
          where: { status: { in: ['ACTIVE', 'FROZEN'] } },
        });
        return competitions.map((competition) => ({
          id: competition.id,
          status:
            competition.status === 'ACTIVE'
              ? ('ACTIVE' as const)
              : ('FROZEN' as const),
        }));
      },
      finalize: (competitionId) => finalizeLeaderboard({ competitionId }),
      processLifecycle: (now) => processCompetitionLifecycle(now),
      recomputeFrozen: recomputeFrozenLeaderboard,
      recomputeLive: recomputeLiveLeaderboard,
    },
  });
  const runCompetitionJobs = async () => {
    try {
      const result = await competitionJobs.runOnce();
      const log = result.failures.length === 0 ? logger.info : logger.error;
      log.call(
        logger,
        {
          activeRecomputed: result.activeRecomputed,
          failures: result.failures,
          finalized: result.finalized,
          frozenRecomputed: result.frozenRecomputed,
          lifecycle: result.lifecycle,
          skippedOverlap: result.skippedOverlap,
        },
        'Competition job cycle completed',
      );
    } catch (error: unknown) {
      logger.error({ error }, 'Competition job cycle failed and will retry');
    } finally {
      if (!shuttingDown) {
        competitionJobTimer = setTimeout(
          () => void runCompetitionJobs(),
          env.COMPETITION_JOB_INTERVAL_MS,
        );
      }
    }
  };
  logger.info(
    {
      autoFinalize: env.AUTO_FINALIZE_FROZEN_COMPETITIONS,
      intervalMs: env.COMPETITION_JOB_INTERVAL_MS,
    },
    'PostgreSQL competition jobs enabled',
  );
  void runCompetitionJobs();
}

if (env.MARKET_DATA_SOURCE === 'mock' && env.MOCK_MARKET_DATA_ENABLED) {
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

if (env.MARKET_DATA_SOURCE === 'twelve-data-trial') {
  const provider = new TwelveDataMarketDataProvider({
    apiKey: env.TWELVE_DATA_API_KEY!,
    fullSpreads: {
      EURUSD: env.TWELVE_DATA_TRIAL_SPREAD_EURUSD!,
      GBPUSD: env.TWELVE_DATA_TRIAL_SPREAD_GBPUSD!,
    },
    onFault: (error) => {
      logger.warn(
        { error: error.message },
        'Twelve Data trial provider event rejected',
      );
    },
    reconnectInitialDelayMs: env.TWELVE_DATA_RECONNECT_INITIAL_MS,
    reconnectMaxDelayMs: env.TWELVE_DATA_RECONNECT_MAX_MS,
    sequence: async () =>
      BigInt(await valkey.incr('market:sequence:v1:twelve-data-trial')),
    trialEndsAt: env.TWELVE_DATA_TRIAL_ENDS_AT!,
  });
  twelveDataTrialHistoricalBackfill = new TwelveDataHistoricalBackfill({
    leaseClient: valkey,
    provider,
  });
  const staffOnlyAccountScope: Prisma.TradingAccountWhereInput = {
    competitionEntry: {
      user: {
        role: { in: ['ADMIN', 'SUPERADMIN'] },
        status: 'ACTIVE',
      },
    },
  };
  twelveDataTrialRuntime = new TwelveDataTrialRuntime({
    accountStatePublisher: {
      publish: async (quote) => {
        await valkey.publish(
          'market:accounts:v1',
          JSON.stringify({
            kind: 'account-state',
            sequence: quote.sequence.toString(),
            symbol: quote.symbol,
            timestamp: quote.timestamp.toISOString(),
          }),
        );
      },
    },
    backfill: async () => {
      const latestFinalMinute = new Date(
        Math.floor(Date.now() / 60_000) * 60_000,
      );
      const results = [];
      for (const symbol of ['EURUSD', 'GBPUSD']) {
        results.push(
          await twelveDataTrialHistoricalBackfill!.backfill({
            from: new Date(
              latestFinalMinute.getTime() -
                env.TWELVE_DATA_TRIAL_HISTORY_MAX_MINUTES * 60_000,
            ),
            symbol,
            to: latestFinalMinute,
          }),
        );
      }
      logger.info(
        {
          coalescedRanges: results.reduce(
            (total, result) => total + result.coalescedRanges,
            0,
          ),
          fetchedBars: results.reduce(
            (total, result) => total + result.fetchedBars,
            0,
          ),
          fetchedRanges: results.reduce(
            (total, result) => total + result.fetchedRanges,
            0,
          ),
          skippedRanges: results.reduce(
            (total, result) => total + result.skippedRanges,
            0,
          ),
        },
        'Twelve Data trial historical bootstrap completed',
      );
    },
    candleProcessor: new LiveCandleProcessor(
      valkey,
      undefined,
      'TWELVE_DATA_TRIAL',
    ),
    leaseClient: valkey,
    logger,
    processor: new PersistentSimulatedExecutionEngine(provider, {
      accountScope: staffOnlyAccountScope,
    }),
    provider,
    quotePublisher: new ValkeyQuoteStore(valkey),
    recover: () => recoverSimulatorState(new Date(), staffOnlyAccountScope),
    symbols: ['EURUSD', 'GBPUSD'],
    trialEndsAt: env.TWELVE_DATA_TRIAL_ENDS_AT!,
    verifyInstrumentConfiguration: () =>
      assertTwelveDataTrialInstrumentConfigurations({
        EURUSD: env.TWELVE_DATA_TRIAL_SPREAD_EURUSD!,
        GBPUSD: env.TWELVE_DATA_TRIAL_SPREAD_GBPUSD!,
      }),
  });
  void twelveDataTrialRuntime.start().catch((error: unknown) => {
    logger.error({ error }, 'Twelve Data trial feed could not initialize');
  });
}

if (env.TWELVE_DATA_PRIVATE_TEST_ENABLED) {
  const twelveDataPrivateProbe = new TwelveDataPrivateProbe({
    apiKey: env.TWELVE_DATA_API_KEY!,
  });
  let nextProbeDelayMs = env.TWELVE_DATA_POLL_INTERVAL_MS;
  const runTwelveDataPrivateProbe = async () => {
    try {
      const samples = await twelveDataPrivateProbe.sample();
      nextProbeDelayMs = env.TWELVE_DATA_POLL_INTERVAL_MS;
      logger.info(
        {
          sampleCount: samples.length,
          symbols: samples.map((sample) => sample.symbol),
        },
        'Twelve Data private non-display probe completed',
      );
    } catch (error: unknown) {
      nextProbeDelayMs = Math.min(nextProbeDelayMs * 2, 3_600_000);
      logger.warn(
        { error, nextProbeDelayMs },
        'Twelve Data private non-display probe failed; retry delayed',
      );
    } finally {
      if (!shuttingDown) {
        twelveDataPrivateProbeTimer = setTimeout(
          () => void runTwelveDataPrivateProbe(),
          nextProbeDelayMs,
        );
      }
    }
  };

  void twelveDataPrivateProbe.subscribe(twelveDataPrivateTestSymbols).then(
    () => void runTwelveDataPrivateProbe(),
    (error: unknown) => {
      logger.error({ error }, 'Twelve Data private probe could not initialize');
    },
  );
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

  if (
    request.method === 'POST' &&
    request.url === '/internal/market-data/twelve-data-trial/backfill'
  ) {
    if (
      env.MARKET_DATA_SOURCE !== 'twelve-data-trial' ||
      twelveDataTrialHistoricalBackfill === null
    ) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    if (
      !hasInternalMarketDataAuthorization(
        request.headers.authorization,
        env.MARKET_DATA_INTERNAL_TOKEN!,
      )
    ) {
      response.statusCode = 401;
      response.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 8_192) {
          throw new TwelveDataTrialInternalApiError('body is too large');
        }
        chunks.push(buffer);
      }
      const input = parseTrialBackfillRequest(
        JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
        env.TWELVE_DATA_TRIAL_HISTORY_MAX_MINUTES,
      );
      const result = await twelveDataTrialHistoricalBackfill.backfill(input);
      response.end(JSON.stringify({ ...result, status: 'ok' }));
    } catch (error: unknown) {
      response.statusCode =
        error instanceof TwelveDataTrialInternalApiError ? 400 : 503;
      response.end(
        JSON.stringify({
          error:
            error instanceof TwelveDataTrialInternalApiError
              ? 'invalid_backfill_request'
              : 'backfill_unavailable',
        }),
      );
    }
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
  if (competitionJobTimer !== null) {
    clearTimeout(competitionJobTimer);
  }
  if (twelveDataPrivateProbeTimer !== null) {
    clearTimeout(twelveDataPrivateProbeTimer);
  }
  await twelveDataTrialRuntime?.stop();
  valkey.disconnect();
  await database.$disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
