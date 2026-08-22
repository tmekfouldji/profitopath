export interface AuthorizedUser {
  id: string;
  role: 'TRADER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

export function canAccessAdmin(user: AuthorizedUser): boolean {
  return user.role === 'ADMIN' && user.status === 'ACTIVE';
}
