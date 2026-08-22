import { z } from 'zod';

const integerPort = z.coerce.number().int().min(1).max(65_535);
const minorUnits = z.coerce.bigint().positive();
const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const runtimeEnvSchema = z.object({
  BUSINESS_TIMEZONE: z.string().min(1).default('UTC'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  MOCK_PAYMENT_SIGNING_SECRET: z.string().min(32),
  MOCK_MARKET_DATA_ENABLED: booleanString,
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  VALKEY_URL: z.string().url().startsWith('redis://'),
});

export const serviceEnvSchema = runtimeEnvSchema.extend({
  PORT: integerPort.default(3000),
});

export const seedEnvSchema = z.object({
  DEV_ELITE_STARTING_BALANCE_MINOR: minorUnits.default(4_000_000n),
  DEV_ROOKIE_STARTING_BALANCE_MINOR: minorUnits.default(1_000_000n),
  DEV_TRADER_STARTING_BALANCE_MINOR: minorUnits.default(2_000_000n),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function parseRuntimeEnv(
  input: NodeJS.ProcessEnv = process.env,
): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}

export function parseSeedEnv(input: NodeJS.ProcessEnv = process.env): SeedEnv {
  return seedEnvSchema.parse(input);
}
