import { describe, expect, it } from 'vitest';

import { loginInputSchema, registrationInputSchema } from './registration';

describe('auth input schemas', () => {
  it('normalizes registration email and display name', () => {
    expect(
      registrationInputSchema.parse({
        displayName: '  Ada Trader  ',
        email: '  ADA@EXAMPLE.COM ',
        password: 'a secure development password',
      }),
    ).toEqual({
      displayName: 'Ada Trader',
      email: 'ada@example.com',
      password: 'a secure development password',
    });
  });

  it('rejects short registration passwords but accepts login validation independently', () => {
    expect(
      registrationInputSchema.safeParse({
        displayName: 'Ada',
        email: 'ada@example.com',
        password: 'short',
      }).success,
    ).toBe(false);
    expect(
      loginInputSchema.safeParse({
        email: 'ADA@example.com',
        password: 'short',
      }).success,
    ).toBe(true);
  });
});
