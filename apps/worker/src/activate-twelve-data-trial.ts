import { database } from '@profitopath/database';
import { workerServiceEnvSchema } from '@profitopath/shared';
import { config } from 'dotenv';

import { activateTwelveDataTrialInstrumentConfigurations } from './twelve-data-trial-configuration';

config({ path: '../../.env', quiet: true });

const env = workerServiceEnvSchema.parse({
  ...process.env,
  PORT: process.env.WORKER_PORT ?? 3002,
});

if (env.MARKET_DATA_SOURCE !== 'twelve-data-trial') {
  throw new Error(
    'MARKET_DATA_SOURCE=twelve-data-trial is required to activate trial instrument versions',
  );
}

try {
  const activated = await activateTwelveDataTrialInstrumentConfigurations({
    EURUSD: env.TWELVE_DATA_TRIAL_SPREAD_EURUSD!,
    GBPUSD: env.TWELVE_DATA_TRIAL_SPREAD_GBPUSD!,
  });
  console.log(
    JSON.stringify({
      activated,
      status: 'ok',
    }),
  );
} finally {
  await database.$disconnect();
}
