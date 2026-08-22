import { z } from 'zod';

const integerPort = z.coerce.number().int().min(1).max(65_535);
const minorUnits = z.coerce.bigint().positive();

export const runtimeEnvSchema = z.object({
  BUSINESS_TIMEZONE: z.string().min(1).default('UTC'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
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
