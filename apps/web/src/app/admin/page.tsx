import { statusLabel } from '@/lib/format';
import { requireAdmin } from '@/server/auth/session';
import { getAdminOverview } from '@/server/queries';

export default async function AdminPage() {
  await requireAdmin();
  const overview = await getAdminOverview();

  return (
    <main className="content-page">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Restricted operations</p>
          <h1>Control room</h1>
        </div>
        <p>
          Read-only visibility into persisted platform state, payment attempts,
          provisioning, and recent audit events.
        </p>
      </header>
      <section className="metric-grid">
        <article>
          <span>Users</span>
          <strong>{overview.users}</strong>
        </article>
        <article>
          <span>Competitions</span>
          <strong>{overview.competitions}</strong>
        </article>
        <article>
          <span>Active accounts</span>
          <strong>{overview.activeAccounts}</strong>
        </article>
        <article>
          <span>Pending payments</span>
          <strong>{overview.pendingPayments}</strong>
        </article>
      </section>
      <section className="audit-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Mock provider operations</p>
            <h2>Recent payments</h2>
          </div>
        </div>
        {overview.recentPayments.length === 0 ? (
          <p className="empty-copy">No payment attempts have been recorded.</p>
        ) : (
          <div className="payment-list">
            {overview.recentPayments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <span>{payment.user.email}</span>
                <strong>{payment.competitionEntry?.tier.code ?? '—'}</strong>
                <span>{statusLabel(payment.status)}</span>
                <span>
                  {payment.competitionEntry?.tradingAccount === null ||
                  payment.competitionEntry === null
                    ? 'Not provisioned'
                    : 'Account active'}
                </span>
                <code>
                  {payment.providerPaymentId?.slice(0, 18) ?? 'reserved'}
                </code>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="audit-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Append-only evidence</p>
            <h2>Recent audit events</h2>
          </div>
        </div>
        {overview.recentAudit.length === 0 ? (
          <p className="empty-copy">No audit events have been recorded.</p>
        ) : (
          <div className="audit-list">
            {overview.recentAudit.map((event) => (
              <div className="audit-row" key={event.id}>
                <span>{event.createdAt.toISOString()}</span>
                <strong>{statusLabel(event.action)}</strong>
                <span>{event.entityType}</span>
                <code>{event.entityId.slice(0, 12)}</code>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
