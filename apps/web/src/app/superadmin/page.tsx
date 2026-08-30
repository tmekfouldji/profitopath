import { formatUsdMinor } from '@profitopath/shared';
import Link from 'next/link';

import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminOverview } from '@/server/queries';

function connectedMemberLabel(connectedMembers: number | null): string {
  return connectedMembers === null ? 'Unavailable' : String(connectedMembers);
}

export default async function SuperadminPage() {
  await requireSuperadmin();
  const overview = await getSuperadminOverview();

  return (
    <section className="superadmin-section superadmin-page">
      <header className="page-heading split-heading superadmin-heading">
        <div>
          <p className="eyebrow">Owner-only operational view</p>
          <h1>Control plane</h1>
        </div>
        <p>
          The business signals below are derived from PostgreSQL and short-lived
          Valkey presence. Configuration reports readiness only—secret values
          never enter this interface.
        </p>
      </header>

      <section
        className="superadmin-command-grid"
        aria-label="Control center sections"
      >
        <Link href="/superadmin/competitions">
          <span>Competition setup</span>
          <strong>Create drafts and publish validated preorder windows.</strong>
        </Link>
        <Link href="/superadmin/challenge-pricing">
          <span>Challenge pricing</span>
          <strong>Set versioned simulated tier fees and rules.</strong>
        </Link>
        <Link href="/superadmin/users">
          <span>Member operations</span>
          <strong>Review users, operational roles, and account status.</strong>
        </Link>
        <Link href="/superadmin/payments">
          <span>Payment ledger</span>
          <strong>Review confirmed revenue and invoice lifecycle state.</strong>
        </Link>
      </section>

      <section
        aria-label="Platform signals"
        className="metric-grid superadmin-metrics"
      >
        <article>
          <span>Registered members</span>
          <strong>{overview.members}</strong>
          <small>{overview.newMembersLast30Days} joined in 30 days</small>
        </article>
        <article>
          <span>Unique visitors · 30d</span>
          <strong>{overview.uniqueVisitorsLast30Days}</strong>
          <small>One anonymous browser per UTC day</small>
        </article>
        <article>
          <span>Connected members</span>
          <strong>{connectedMemberLabel(overview.connectedMembers)}</strong>
          <small>Signed in and active within five minutes</small>
        </article>
        <article>
          <span>Confirmed revenue</span>
          <strong>{formatUsdMinor(overview.confirmedRevenueMinor)}</strong>
          <small>{overview.confirmedPayments} confirmed payments</small>
        </article>
        <article>
          <span>Simulated accounts</span>
          <strong>{overview.totalAccounts}</strong>
          <small>{overview.activeAccounts} currently active</small>
        </article>
      </section>

      <section className="superadmin-config">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Deployment signal board</p>
            <h2>Configuration health</h2>
          </div>
          <p>
            Secret values are managed on the launch host and require a service
            restart. This screen intentionally reports their state, never their
            contents.
          </p>
        </div>
        <dl className="superadmin-config-grid">
          <div>
            <dt>Public origin</dt>
            <dd>{overview.configuration.publicOrigin}</dd>
          </div>
          <div>
            <dt>Checkout provider</dt>
            <dd>{overview.configuration.nowPayments}</dd>
          </div>
          <div>
            <dt>Payment mode</dt>
            <dd>{overview.configuration.paymentProvider}</dd>
          </div>
          <div>
            <dt>Market data</dt>
            <dd>{overview.configuration.marketData}</dd>
          </div>
          <div>
            <dt>Market-data source</dt>
            <dd>{overview.configuration.marketDataSource}</dd>
          </div>
          <div>
            <dt>Email verification</dt>
            <dd>{overview.configuration.email}</dd>
          </div>
        </dl>
      </section>

      <section className="superadmin-definitions">
        <div>
          <p className="eyebrow">Metric definitions</p>
          <h2>Read the signals correctly</h2>
        </div>
        <dl>
          <div>
            <dt>Visitors</dt>
            <dd>
              Daily unique browser visits, retained without IP addresses,
              user-agent strings, or raw visitor identifiers.
            </dd>
          </div>
          <div>
            <dt>Connected members</dt>
            <dd>
              Signed-in members with a visible active page heartbeat during the
              last five minutes. It is not a historical login count.
            </dd>
          </div>
          <div>
            <dt>Revenue</dt>
            <dd>
              Confirmed USD competition-entry payments only. Pending, failed,
              expired, and company-funded prize records are excluded.
            </dd>
          </div>
          <div>
            <dt>Email confirmation</dt>
            <dd>
              Registration sends a one-time confirmation link through the
              configured SMTP provider. Password sign-in remains unavailable
              until that link is confirmed.
            </dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
