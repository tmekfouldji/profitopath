import Link from 'next/link';
import type { ReactNode } from 'react';

import { requireSuperadmin } from '@/server/auth/session';

const navigation = [
  { href: '/superadmin', label: 'Overview' },
  { href: '/superadmin/competitions', label: 'Competitions' },
  { href: '/superadmin/challenge-pricing', label: 'Challenge pricing' },
  { href: '/superadmin/users', label: 'Users' },
  { href: '/superadmin/payments', label: 'Payments' },
  { href: '/superadmin/payouts', label: 'Payout operations' },
  { href: '/superadmin/settings', label: 'System readiness' },
] as const;

export default async function SuperadminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireSuperadmin();

  return (
    <div className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h2>Control center</h2>
          <p className="superadmin-sidebar-copy">
            Platform operations are separate from the trader account desk.
          </p>
        </div>
        <nav aria-label="Control center navigation" className="superadmin-nav">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="superadmin-return-link" href="/dashboard">
          Back to my trading desk
        </Link>
      </aside>
      <div className="superadmin-workspace">{children}</div>
    </div>
  );
}
