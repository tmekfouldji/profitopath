import { describe, expect, it } from 'vitest';

import {
  canAccessAdmin,
  canAccessSuperadmin,
  canSignIn,
} from './authorization';

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
    expect(
      canAccessAdmin({ id: '5', role: 'SUPERADMIN', status: 'ACTIVE' }),
    ).toBe(true);
  });

  it('limits the control plane to active superadmins', () => {
    expect(
      canAccessSuperadmin({
        id: '1',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      }),
    ).toBe(true);
    expect(
      canAccessSuperadmin({ id: '2', role: 'ADMIN', status: 'ACTIVE' }),
    ).toBe(false);
    expect(
      canAccessSuperadmin({
        id: '3',
        role: 'SUPERADMIN',
        status: 'SUSPENDED',
      }),
    ).toBe(false);
  });

  it('requires a confirmed email before password sign-in', () => {
    expect(
      canSignIn({
        emailVerified: new Date('2026-08-30T12:00:00.000Z'),
        status: 'ACTIVE',
      }),
    ).toBe(true);
    expect(canSignIn({ emailVerified: null, status: 'ACTIVE' })).toBe(false);
    expect(
      canSignIn({
        emailVerified: new Date('2026-08-30T12:00:00.000Z'),
        status: 'SUSPENDED',
      }),
    ).toBe(false);
  });
});
