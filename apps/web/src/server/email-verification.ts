import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { database } from '@profitopath/database';
import { parseRuntimeEnv } from '@profitopath/shared';

export const verificationTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashEmailVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function emailVerificationExpiry(now = new Date()): Date {
  const env = parseRuntimeEnv();
  return new Date(
    now.getTime() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000,
  );
}

export function emailVerificationUrl(token: string): string {
  const env = parseRuntimeEnv();
  const url = new URL('/verify-email', env.NEXTAUTH_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function consumeEmailVerificationToken(
  token: string,
): Promise<'already_verified' | 'invalid' | 'verified'> {
  if (!verificationTokenPattern.test(token)) {
    return 'invalid';
  }

  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();
  return database.$transaction(async (transaction) => {
    const persisted = await transaction.verificationToken.findUnique({
      select: { identifier: true },
      where: { token: tokenHash },
    });
    if (persisted === null) {
      return 'invalid';
    }

    const consumed = await transaction.verificationToken.deleteMany({
      where: { expires: { gt: now }, token: tokenHash },
    });
    if (consumed.count !== 1) {
      return 'invalid';
    }

    const user = await transaction.user.findUnique({
      select: { emailVerified: true, id: true },
      where: { email: persisted.identifier },
    });
    if (user === null) {
      return 'invalid';
    }
    if (user.emailVerified !== null) {
      return 'already_verified';
    }

    await transaction.user.update({
      data: { emailVerified: now },
      where: { id: user.id },
    });
    await transaction.verificationToken.deleteMany({
      where: { identifier: persisted.identifier },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'EMAIL_VERIFIED',
        actorUserId: user.id,
        after: { emailVerified: true },
        entityId: user.id,
        entityType: 'User',
      },
    });
    return 'verified';
  });
}
