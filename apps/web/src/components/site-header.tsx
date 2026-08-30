import Link from 'next/link';

import { LogoutButton } from './logout-button';

export interface HeaderUser {
  name: string | null | undefined;
  role: 'TRADER' | 'ADMIN' | 'SUPERADMIN';
}

export function SiteHeader({ user }: { user: HeaderUser | undefined }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link aria-label="Profitopath home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            <span>P</span>
          </span>
          <span className="brand-copy">
            <strong>Profitopath</strong>
            <small>Weekly simulation</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="primary-nav">
          <div className="nav-main">
            <Link href="/competitions">Competitions</Link>
            <Link href="/leaderboards">Standings</Link>
          </div>
          <div className="nav-account">
            {user === undefined ? (
              <>
                <Link href="/login">Sign in</Link>
                <Link className="nav-cta" href="/register">
                  Join a week
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">My desk</Link>
                {user.role === 'ADMIN' || user.role === 'SUPERADMIN' ? (
                  <Link href="/admin">Admin</Link>
                ) : null}
                {user.role === 'SUPERADMIN' ? (
                  <Link href="/superadmin">Control plane</Link>
                ) : null}
                <span className="user-chip">{user.name ?? 'Trader'}</span>
                <LogoutButton />
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
