import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminOverview } from '@/server/queries';

export default async function SuperadminSettingsPage() {
  await requireSuperadmin();
  const overview = await getSuperadminOverview();

  return (
    <section className="superadmin-section">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Launch machine</p>
          <h1>System readiness</h1>
        </div>
        <p>
          This screen reports only configuration health. API keys, SMTP
          passwords, IPN secrets, database URLs, and other raw deployment
          secrets remain server-only in the launch environment.
        </p>
      </header>

      <section className="superadmin-config">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Configuration health</p>
            <h2>Launch signals</h2>
          </div>
          <p>
            Update the protected launch environment and restart services to
            change a secret.
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
    </section>
  );
}
