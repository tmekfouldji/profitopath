import { describe, expect, it } from 'vitest';

import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  verificationTokenPattern,
} from './email-verification';

describe('email verification tokens', () => {
  it('creates opaque single-use link values while persisting only their hash', () => {
    const token = createEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(token);

    expect(verificationTokenPattern.test(token)).toBe(true);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toContain(token);
    expect(hashEmailVerificationToken(token)).toBe(tokenHash);
  });
});
