import { z } from 'zod';

const integerPort = z.coerce.number().int().min(1).max(65_535);
const minorUnits = z.coerce.bigint().positive();
const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const runtimeEnvSchema = z
  .object({
    AUTH_LOGIN_EMAIL_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(5),
    AUTH_LOGIN_IP_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(25),
    AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(900),
    AUTO_FINALIZE_FROZEN_COMPETITIONS: booleanString,
    BUSINESS_TIMEZONE: z.string().min(1).default('UTC'),
    COMPETITION_JOB_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(15_000),
    COMPETITION_JOBS_ENABLED: booleanString.default(true),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MARKET_DATA_SOURCE: z.literal('mock').default('mock'),
    MOCK_PAYMENT_SIGNING_SECRET: z.string().min(32),
    MOCK_MARKET_DATA_ENABLED: booleanString,
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    NEXTAUTH_SECRET: z.string().min(32),
    NEXTAUTH_URL: z.string().url(),
    NOWPAYMENTS_API_KEY: z.string().min(1).optional(),
    NOWPAYMENTS_IPN_SECRET: z.string().min(1).optional(),
    PAYMENT_PROVIDER: z.enum(['mock', 'nowpayments']).default('mock'),
    VALKEY_URL: z.string().url().startsWith('redis://'),
  })
  .superRefine((value, context) => {
    if (
      value.PAYMENT_PROVIDER === 'nowpayments' &&
      (value.NOWPAYMENTS_API_KEY === undefined ||
        value.NOWPAYMENTS_IPN_SECRET === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET are required when PAYMENT_PROVIDER=nowpayments',
        path: ['PAYMENT_PROVIDER'],
      });
    }
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
