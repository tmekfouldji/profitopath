import Link from 'next/link';

import { formatUsdMinor } from '@profitopath/shared';

import { statusLabel } from '@/lib/format';
import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminPaymentLedger } from '@/server/queries';

export default async function SuperadminPaymentsPage() {
  await requireSuperadmin();
  const ledger = await getSuperadminPaymentLedger();

  return (
    <section className="superadmin-section">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Checkout and revenue</p>
          <h1>Payments</h1>
        </div>
        <p>
          Provider events and amounts remain in the payments ledger. Confirmed
          revenue excludes pending, failed, expired, cancelled, and refunded
          invoice records.
        </p>
      </header>

      <section className="metric-grid superadmin-payment-metrics">
        <article>
          <span>Confirmed revenue</span>
          <strong>{formatUsdMinor(ledger.confirmedRevenueMinor)}</strong>
          <small>USD confirmed invoices only</small>
        </article>
        <article>
          <span>Confirmed</span>
          <strong>{ledger.paymentCounts.CONFIRMED ?? 0}</strong>
          <small>Provisioned after verified provider event</small>
        </article>
        <article>
          <span>Pending</span>
          <strong>
            {(ledger.paymentCounts.CREATED ?? 0) +
              (ledger.paymentCounts.PENDING ?? 0)}
          </strong>
          <small>Invoice awaiting payment/IPN confirmation</small>
        </article>
        <article>
          <span>Exception states</span>
          <strong>
            {(ledger.paymentCounts.FAILED ?? 0) +
              (ledger.paymentCounts.EXPIRED ?? 0) +
              (ledger.paymentCounts.CANCELLED ?? 0) +
              (ledger.paymentCounts.REFUNDED ?? 0)}
          </strong>
          <small>Review provider evidence before any customer response</small>
        </article>
      </section>

      <section className="superadmin-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Payment ledger</p>
            <h2>Latest 100 invoices</h2>
          </div>
          <p>
            Company-funded prizes and manual payout evidence are operated in a
            separate dual-review workflow.
          </p>
        </div>
        {ledger.payments.length === 0 ? (
          <p className="empty-copy">No checkout attempts have been recorded.</p>
        ) : (
          <div className="superadmin-payment-list">
            {ledger.payments.map((payment) => (
              <article className="superadmin-payment-row" key={payment.id}>
                <div>
                  <span
                    className={`status-pill status-${payment.status.toLowerCase()}`}
                  >
                    {statusLabel(payment.status)}
                  </span>
                  <strong>
                    {payment.user.name?.trim() || payment.user.email}
                  </strong>
                  <code>{payment.user.email}</code>
                </div>
                <div>
                  <span>Competition</span>
                  <strong>
                    {payment.competitionEntry?.competition.name ?? 'Unassigned'}
                  </strong>
                  <code>
                    {payment.competitionEntry?.competition.code ?? '—'}
                  </code>
                </div>
                <div>
                  <span>Tier</span>
                  <strong>{payment.competitionEntry?.tier.name ?? '—'}</strong>
                  <code>{payment.competitionEntry?.tier.code ?? '—'}</code>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{formatUsdMinor(payment.amountMinor)}</strong>
                  <code>{payment.provider}</code>
                </div>
                <div>
                  <span>Invoice</span>
                  <code>
                    {payment.providerInvoiceId ??
                      payment.providerPaymentId ??
                      'Reserved'}
                  </code>
                  <small>
                    {payment.createdAt
                      .toISOString()
                      .replace('T', ' ')
                      .slice(0, 16)}{' '}
                    UTC
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="superadmin-callout">
        <div>
          <p className="eyebrow">Company-funded prizes</p>
          <h2>Payouts require evidence and separate review</h2>
          <p>
            Payouts are not a customer balance or automatic crypto transfer. The
            existing operations console requires winner/KYC review, a second
            approval, a retained transaction reference, and reconciliation.
          </p>
        </div>
        <Link className="button button-primary" href="/superadmin/payouts">
          Open payout operations
        </Link>
      </section>
    </section>
  );
}
