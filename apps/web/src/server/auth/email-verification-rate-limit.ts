import 'server-only';

import { createHash } from 'node:crypto';

import {
  createLogger,
  createValkeyClient,
  parseRuntimeEnv,
} from '@profitopath/shared';

const resendCooldownSeconds = 60;
const logger = createLogger({
  service: 'web-email-verification-rate-limit',
  version: '0.1.0',
});
let valkey: ReturnType<typeof createValkeyClient> | undefined;

function resendKey(email: string): string {
  const emailHash = createHash('sha256').update(email).digest('base64url');
  return `auth:email-verification-resend:v1:${emailHash}`;
}

function configuredValkey(): ReturnType<typeof createValkeyClient> {
  if (valkey !== undefined) {
    return valkey;
  }
  const env = parseRuntimeEnv();
  valkey = createValkeyClient(env.VALKEY_URL, (error) => {
    logger.warn({ error }, 'Email verification rate-limit Valkey error');
  });
  return valkey;
}

async function ensureReady(
  client: ReturnType<typeof createValkeyClient>,
): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
  if (client.status !== 'ready') {
    throw new Error(`Email verification rate-limit Valkey is ${client.status}`);
  }
}

export async function reserveVerificationEmailResend(
  email: string,
): Promise<boolean> {
  try {
    const client = configuredValkey();
    await ensureReady(client);
    const result = await client.set(
      resendKey(email),
      '1',
      'EX',
      resendCooldownSeconds,
      'NX',
    );
    return result === 'OK';
  } catch (error) {
    logger.warn(
      { error },
      'Email verification resend rate limiter unavailable',
    );
    return false;
  }
}
