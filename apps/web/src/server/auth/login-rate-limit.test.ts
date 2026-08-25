import { describe, expect, it, vi } from 'vitest';

import {
  createLoginRateLimiter,
  loginAuditIdentifier,
} from './login-rate-limit';

function limiter(values: Array<string | null> = ['0', '0']) {
  const store = {
    eval: vi.fn().mockResolvedValue([1, 1]),
    mget: vi.fn().mockResolvedValue(values),
  };
  return {
    limiter: createLoginRateLimiter(store, {
      emailMaxAttempts: 5,
      ipMaxAttempts: 25,
      windowSeconds: 900,
    }),
    store,
  };
}

describe('credential rate limiting', () => {
  it('blocks an email after its bounded number of failed attempts', async () => {
    const { limiter: subject } = limiter(['5', '3']);

    await expect(
      subject.check('trader@example.com', { 'x-forwarded-for': '203.0.113.8' }),
    ).resolves.toEqual({ allowed: false, unavailable: false });
  });

  it('uses the first forwarded address and never stores a raw email in a Valkey key', async () => {
    const { limiter: subject, store } = limiter();

    await subject.recordFailure('trader@example.com', {
      'x-forwarded-for': '203.0.113.8, 198.51.100.9',
    });

    expect(store.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      `auth:login:email:v1:${loginAuditIdentifier('trader@example.com')}`,
      `auth:login:ip:v1:${loginAuditIdentifier('203.0.113.8')}`,
      '900',
    );
    expect(JSON.stringify(store.eval.mock.calls)).not.toContain(
      'trader@example.com',
    );
  });

  it('fails closed when the backing store cannot be read', async () => {
    const { limiter: subject, store } = limiter();
    store.mget.mockRejectedValueOnce(new Error('Valkey unavailable'));

    await expect(subject.check('trader@example.com', {})).resolves.toEqual({
      allowed: false,
      unavailable: true,
    });
  });
});
