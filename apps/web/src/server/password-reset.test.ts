import { database } from '@profitopath/database';
import { afterEach, describe, expect, it } from 'vitest';

import {
  consumePasswordResetToken,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetTokenPattern,
} from './password-reset';

describe('password reset tokens', () => {
  it('creates opaque single-use link values while persisting only their hash', () => {
    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);

    expect(passwordResetTokenPattern.test(token)).toBe(true);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toContain(token);
    expect(hashPasswordResetToken(token)).toBe(tokenHash);
  });
});

const integrationTest = describe.runIf(
  process.env.RUN_DATABASE_TESTS === 'true',
);
const userIds: string[] = [];

afterEach(async () => {
  const ids = userIds.splice(0);
  if (ids.length > 0) {
    await database.user.deleteMany({ where: { id: { in: ids } } });
  }
});

integrationTest('password reset consumption', () => {
  it('replaces the credential, invalidates prior sessions, and consumes the token once', async () => {
    const user = await database.user.create({
      data: {
        credential: { create: { passwordHash: 'before-reset' } },
        email: `reset-${crypto.randomUUID()}@example.test`,
        emailVerified: new Date(),
      },
    });
    userIds.push(user.id);
    const token = createPasswordResetToken();
    await database.passwordResetToken.create({
      data: {
        expires: new Date(Date.now() + 60_000),
        token: hashPasswordResetToken(token),
        userId: user.id,
      },
    });

    await expect(consumePasswordResetToken(token, 'after-reset')).resolves.toBe(
      'reset',
    );
    await expect(
      consumePasswordResetToken(token, 'another-password'),
    ).resolves.toBe('invalid');

    await expect(
      database.user.findUniqueOrThrow({
        include: { credential: true, passwordResetTokens: true },
        where: { id: user.id },
      }),
    ).resolves.toMatchObject({
      credential: { passwordHash: 'after-reset' },
      credentialVersion: 1,
      passwordResetTokens: [],
    });
  });
});
