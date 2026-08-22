import Link from 'next/link';

import { LogoutButton } from './logout-button';

export interface HeaderUser {
  name: string | null | undefined;
  role: 'TRADER' | 'ADMIN';
}

export function SiteHeader({ user }: { user: HeaderUser | undefined }) {
  return (
    <header className="site-header">
      <Link aria-label="Profitopath home" className="brand" href="/">
        <span aria-hidden="true" className="brand-mark">
          P/
        </span>
        <span>Profitopath</span>
      </Link>
      <nav aria-label="Primary navigation" className="primary-nav">
        <Link href="/competitions">Competitions</Link>
        <Link href="/leaderboards">Leaderboards</Link>
        {user === undefined ? (
          <>
            <Link href="/login">Sign in</Link>
            <Link className="nav-cta" href="/register">
              Create account
            </Link>
          </>
        ) : (
          <>
            <Link href="/dashboard">Dashboard</Link>
            {user.role === 'ADMIN' ? <Link href="/admin">Admin</Link> : null}
            <span className="user-chip">{user.name ?? 'Trader'}</span>
            <LogoutButton />
          </>
        )}
      </nav>
    </header>
  );
}
