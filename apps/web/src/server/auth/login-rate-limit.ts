import 'server-only';

import { createHash } from 'node:crypto';

import {
  createLogger,
  createValkeyClient,
  parseRuntimeEnv,
} from '@profitopath/shared';

type RequestHeaders = Record<string, string | string[] | undefined>;

interface LoginRateLimitStore {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  mget(...keys: string[]): Promise<Array<string | null>>;
}

export interface LoginRateLimitResult {
  allowed: boolean;
  unavailable: boolean;
}

export interface LoginRateLimiter {
  check(email: string, headers: RequestHeaders): Promise<LoginRateLimitResult>;
  recordFailure(email: string, headers: RequestHeaders): Promise<void>;
}

interface LoginRateLimitConfig {
  emailMaxAttempts: number;
  ipMaxAttempts: number;
  windowSeconds: number;
}

const incrementFailureScript = `
  local emailAttempts = redis.call('INCR', KEYS[1])
  if emailAttempts == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  local ipAttempts = redis.call('INCR', KEYS[2])
  if ipAttempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
  return {emailAttempts, ipAttempts}
`;

function headerValue(
  headers: RequestHeaders,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function clientAddress(headers: RequestHeaders): string {
  const forwarded =
    headerValue(headers, 'x-forwarded-for') ??
    headerValue(headers, 'x-real-ip');
  const address = forwarded?.split(',')[0]?.trim();
  return address === undefined || address.length === 0
    ? 'unknown'
    : address.slice(0, 128);
}

export function loginAuditIdentifier(email: string): string {
  return createHash('sha256').update(email).digest('base64url').slice(0, 43);
}

function rateLimitKeys(
  email: string,
  headers: RequestHeaders,
): [string, string] {
  return [
    `auth:login:email:v1:${loginAuditIdentifier(email)}`,
    `auth:login:ip:v1:${loginAuditIdentifier(clientAddress(headers))}`,
  ];
}

function attempts(value: string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0
    ? parsed
    : Number.MAX_SAFE_INTEGER;
}

export function createLoginRateLimiter(
  store: LoginRateLimitStore,
  config: LoginRateLimitConfig,
): LoginRateLimiter {
  return {
    async check(email, headers) {
      try {
        const [emailKey, ipKey] = rateLimitKeys(email, headers);
        const [emailAttempts, ipAttempts] = await store.mget(emailKey, ipKey);
        return {
          allowed:
            attempts(emailAttempts) < config.emailMaxAttempts &&
            attempts(ipAttempts) < config.ipMaxAttempts,
          unavailable: false,
        };
      } catch {
        return { allowed: false, unavailable: true };
      }
    },
    async recordFailure(email, headers) {
      const [emailKey, ipKey] = rateLimitKeys(email, headers);
      await store.eval(
        incrementFailureScript,
        2,
        emailKey,
        ipKey,
        String(config.windowSeconds),
      );
    },
  };
}

const logger = createLogger({
  service: 'web-auth-rate-limit',
  version: '0.1.0',
});
let valkey: ReturnType<typeof createValkeyClient> | undefined;
let loginRateLimiter: LoginRateLimiter | undefined;

function configuredRateLimiter(): {
  client: ReturnType<typeof createValkeyClient>;
  limiter: LoginRateLimiter;
} {
  if (valkey !== undefined && loginRateLimiter !== undefined) {
    return { client: valkey, limiter: loginRateLimiter };
  }

  const env = parseRuntimeEnv();
  valkey = createValkeyClient(env.VALKEY_URL, (error) => {
    logger.warn({ error }, 'Authentication rate-limit Valkey connection error');
  });
  loginRateLimiter = createLoginRateLimiter(valkey, {
    emailMaxAttempts: env.AUTH_LOGIN_EMAIL_MAX_ATTEMPTS,
    ipMaxAttempts: env.AUTH_LOGIN_IP_MAX_ATTEMPTS,
    windowSeconds: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  });
  return { client: valkey, limiter: loginRateLimiter };
}

async function ensureConnected(
  client: ReturnType<typeof createValkeyClient>,
): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
  if (client.status !== 'ready') {
    throw new Error(`Authentication rate-limit Valkey is ${client.status}`);
  }
}

export const authLoginRateLimiter: LoginRateLimiter = {
  async check(email, headers) {
    try {
      const { client, limiter } = configuredRateLimiter();
      await ensureConnected(client);
      return await limiter.check(email, headers);
    } catch (error) {
      logger.warn({ error }, 'Authentication rate limiter unavailable');
      return { allowed: false, unavailable: true };
    }
  },
  async recordFailure(email, headers) {
    try {
      const { client, limiter } = configuredRateLimiter();
      await ensureConnected(client);
      await limiter.recordFailure(email, headers);
    } catch (error) {
      logger.warn(
        { error },
        'Authentication rate-limit failure could not be recorded',
      );
    }
  },
};
