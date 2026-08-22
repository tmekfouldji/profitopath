import { describe, expect, it } from 'vitest';

import { canAccessAdmin } from './authorization';

describe('canAccessAdmin', () => {
  it('allows only active administrators', () => {
    expect(canAccessAdmin({ id: '1', role: 'ADMIN', status: 'ACTIVE' })).toBe(
      true,
    );
    expect(canAccessAdmin({ id: '2', role: 'TRADER', status: 'ACTIVE' })).toBe(
      false,
    );
    expect(
      canAccessAdmin({ id: '3', role: 'ADMIN', status: 'SUSPENDED' }),
    ).toBe(false);
    expect(canAccessAdmin({ id: '4', role: 'ADMIN', status: 'CLOSED' })).toBe(
      false,
    );
  });
});
