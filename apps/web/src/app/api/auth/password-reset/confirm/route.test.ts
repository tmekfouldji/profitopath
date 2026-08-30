import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumePasswordResetToken: vi.fn(),
}));

vi.mock('@/server/password-reset', () => ({
  consumePasswordResetToken: mocks.consumePasswordResetToken,
}));

import { POST } from './route';

describe('password-reset confirmation route', () => {
  it('accepts a valid new password only after the server consumes its token', async () => {
    mocks.consumePasswordResetToken.mockResolvedValue('reset');
    const token = 'a'.repeat(43);

    const response = await POST(
      new Request(
        'https://profitopath.example.test/api/auth/password-reset/confirm',
        {
          body: JSON.stringify({ password: 'new secure password', token }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'password_reset',
    });
    expect(mocks.consumePasswordResetToken).toHaveBeenCalledWith(
      token,
      expect.stringMatching(/^scrypt-v1\$/),
    );
  });

  it('rejects an expired or already-used token', async () => {
    mocks.consumePasswordResetToken.mockResolvedValue('invalid');

    const response = await POST(
      new Request(
        'https://profitopath.example.test/api/auth/password-reset/confirm',
        {
          body: JSON.stringify({
            password: 'new secure password',
            token: 'b'.repeat(43),
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_reset' });
  });
});
