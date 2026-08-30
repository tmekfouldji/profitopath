import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { database } from '@profitopath/database';
import { parseRuntimeEnv } from '@profitopath/shared';

export const passwordResetTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function passwordResetExpiry(now = new Date()): Date {
  const env = parseRuntimeEnv();
  return new Date(
    now.getTime() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );
}

export function passwordResetUrl(token: string): string {
  const env = parseRuntimeEnv();
  const url = new URL('/reset-password', env.NEXTAUTH_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function consumePasswordResetToken(
  token: string,
  passwordHash: string,
): Promise<'invalid' | 'reset'> {
  if (!passwordResetTokenPattern.test(token)) {
    return 'invalid';
  }

  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  return database.$transaction(async (transaction) => {
    const persisted = await transaction.passwordResetToken.findUnique({
      select: { expires: true, userId: true },
      where: { token: tokenHash },
    });
    if (persisted === null || persisted.expires <= now) {
      return 'invalid';
    }

    const credential = await transaction.passwordCredential.findUnique({
      select: { userId: true },
      where: { userId: persisted.userId },
    });
    if (credential === null) {
      return 'invalid';
    }

    const consumed = await transaction.passwordResetToken.deleteMany({
      where: { expires: { gt: now }, token: tokenHash },
    });
    if (consumed.count !== 1) {
      return 'invalid';
    }

    await transaction.passwordCredential.update({
      data: { passwordHash },
      where: { userId: persisted.userId },
    });
    await transaction.user.update({
      data: { credentialVersion: { increment: 1 } },
      where: { id: persisted.userId },
    });
    await transaction.passwordResetToken.deleteMany({
      where: { userId: persisted.userId },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PASSWORD_RESET_COMPLETED',
        actorUserId: persisted.userId,
        entityId: persisted.userId,
        entityType: 'User',
      },
    });
    return 'reset';
  });
}
