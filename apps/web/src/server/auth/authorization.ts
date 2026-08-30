export interface AuthorizedUser {
  id: string;
  role: 'TRADER' | 'ADMIN' | 'SUPERADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

export function canAccessAdmin(user: AuthorizedUser): boolean {
  return (
    (user.role === 'ADMIN' || user.role === 'SUPERADMIN') &&
    user.status === 'ACTIVE'
  );
}

export function canAccessSuperadmin(user: AuthorizedUser): boolean {
  return user.role === 'SUPERADMIN' && user.status === 'ACTIVE';
}

export function canSignIn(user: {
  emailVerified: Date | null;
  status: AuthorizedUser['status'];
}): boolean {
  return user.status === 'ACTIVE' && user.emailVerified !== null;
}
