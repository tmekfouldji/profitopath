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
    EMAIL_FROM: z.string().email().optional(),
    EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(15)
      .max(1_440)
      .default(60),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MARKET_DATA_INTERNAL_TOKEN: z.string().min(32).optional(),
    MARKET_DATA_SOURCE: z.enum(['mock', 'twelve-data-trial']).default('mock'),
    MARKET_DATA_WORKER_INTERNAL_URL: z.string().url().optional(),
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
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(15)
      .max(1_440)
      .default(60),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_PORT: integerPort.optional(),
    SMTP_USER: z.string().email().optional(),
    TWELVE_DATA_API_KEY: z.string().min(1).optional(),
    TWELVE_DATA_RECONNECT_INITIAL_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(30_000)
      .default(1_000),
    TWELVE_DATA_RECONNECT_MAX_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(30_000),
    TWELVE_DATA_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(300_000)
      .max(3_600_000)
      .default(300_000),
    TWELVE_DATA_PRIVATE_TEST_ENABLED: booleanString,
    TWELVE_DATA_TRIAL_ENDS_AT: z.coerce.date().optional(),
    TWELVE_DATA_TRIAL_HISTORY_MAX_MINUTES: z.coerce
      .number()
      .int()
      .min(240)
      .max(43_200)
      .default(10_080),
    TWELVE_DATA_TRIAL_STAFF_ONLY: booleanString.default(true),
    TWELVE_DATA_TRIAL_SPREAD_EURUSD: z.string().optional(),
    TWELVE_DATA_TRIAL_SPREAD_GBPUSD: z.string().optional(),
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
    if (
      value.EMAIL_PROVIDER === 'smtp' &&
      (value.EMAIL_FROM === undefined ||
        value.SMTP_HOST === undefined ||
        value.SMTP_PASSWORD === undefined ||
        value.SMTP_PORT === undefined ||
        value.SMTP_USER === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD are required when EMAIL_PROVIDER=smtp',
        path: ['EMAIL_PROVIDER'],
      });
    }
    if (value.MARKET_DATA_SOURCE === 'twelve-data-trial') {
      if (value.TWELVE_DATA_PRIVATE_TEST_ENABLED) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'TWELVE_DATA_PRIVATE_TEST_ENABLED cannot be combined with MARKET_DATA_SOURCE=twelve-data-trial',
          path: ['TWELVE_DATA_PRIVATE_TEST_ENABLED'],
        });
      }
      if (value.MOCK_MARKET_DATA_ENABLED) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'MOCK_MARKET_DATA_ENABLED cannot be combined with MARKET_DATA_SOURCE=twelve-data-trial',
          path: ['MOCK_MARKET_DATA_ENABLED'],
        });
      }
      if (value.TWELVE_DATA_TRIAL_ENDS_AT === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'TWELVE_DATA_TRIAL_ENDS_AT is required when MARKET_DATA_SOURCE=twelve-data-trial',
          path: ['TWELVE_DATA_TRIAL_ENDS_AT'],
        });
      }
      if (!value.TWELVE_DATA_TRIAL_STAFF_ONLY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'TWELVE_DATA_TRIAL_STAFF_ONLY must remain true during the commercial trial',
          path: ['TWELVE_DATA_TRIAL_STAFF_ONLY'],
        });
      }
      if (
        value.TWELVE_DATA_TRIAL_SPREAD_EURUSD === undefined ||
        value.TWELVE_DATA_TRIAL_SPREAD_GBPUSD === undefined
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'TWELVE_DATA_TRIAL_SPREAD_EURUSD and TWELVE_DATA_TRIAL_SPREAD_GBPUSD are required when MARKET_DATA_SOURCE=twelve-data-trial',
          path: ['MARKET_DATA_SOURCE'],
        });
      }
      if (
        value.TWELVE_DATA_RECONNECT_MAX_MS <
        value.TWELVE_DATA_RECONNECT_INITIAL_MS
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'TWELVE_DATA_RECONNECT_MAX_MS must be greater than or equal to TWELVE_DATA_RECONNECT_INITIAL_MS',
          path: ['TWELVE_DATA_RECONNECT_MAX_MS'],
        });
      }
    }
  });

export const serviceEnvSchema = runtimeEnvSchema.extend({
  PORT: integerPort.default(3000),
});

function requireInternalTrialBoundary(
  value: z.infer<typeof runtimeEnvSchema>,
  context: z.RefinementCtx,
): void {
  if (
    value.MARKET_DATA_SOURCE === 'twelve-data-trial' &&
    (value.MARKET_DATA_INTERNAL_TOKEN === undefined ||
      value.MARKET_DATA_WORKER_INTERNAL_URL === undefined)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'MARKET_DATA_INTERNAL_TOKEN and MARKET_DATA_WORKER_INTERNAL_URL are required for the Twelve Data web-to-worker boundary',
      path: ['MARKET_DATA_SOURCE'],
    });
  }
}

export const webRuntimeEnvSchema = runtimeEnvSchema.superRefine(
  requireInternalTrialBoundary,
);

/**
 * Only the worker is permitted to read a Twelve Data provider credential.
 * Other services validate their staff-only trial configuration without
 * receiving that credential at all.
 */
export const workerServiceEnvSchema = serviceEnvSchema.superRefine(
  (value, context) => {
    requireInternalTrialBoundary(value, context);
    if (
      (value.MARKET_DATA_SOURCE === 'twelve-data-trial' ||
        value.TWELVE_DATA_PRIVATE_TEST_ENABLED) &&
      value.TWELVE_DATA_API_KEY === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'TWELVE_DATA_API_KEY is required for a worker-owned Twelve Data source',
        path: ['TWELVE_DATA_API_KEY'],
      });
    }
    if (value.TWELVE_DATA_PRIVATE_TEST_ENABLED) {
      const origin = new URL(value.NEXTAUTH_URL);
      const isLoopbackOrigin =
        origin.hostname === 'localhost' ||
        origin.hostname === '127.0.0.1' ||
        origin.hostname === '::1';
      if (value.NODE_ENV === 'production' || !isLoopbackOrigin) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Twelve Data Basic testing is restricted to a development/test loopback environment',
          path: ['TWELVE_DATA_PRIVATE_TEST_ENABLED'],
        });
      }
    }
  },
);

export const seedEnvSchema = z.object({
  DEV_ELITE_STARTING_BALANCE_MINOR: minorUnits.default(4_000_000n),
  DEV_ROOKIE_STARTING_BALANCE_MINOR: minorUnits.default(1_000_000n),
  DEV_TRADER_STARTING_BALANCE_MINOR: minorUnits.default(2_000_000n),
});

export type RuntimeEnv = z.infer<typeof webRuntimeEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function parseRuntimeEnv(
  input: NodeJS.ProcessEnv = process.env,
): RuntimeEnv {
  return webRuntimeEnvSchema.parse(input);
}

export function parseSeedEnv(input: NodeJS.ProcessEnv = process.env): SeedEnv {
  return seedEnvSchema.parse(input);
}
