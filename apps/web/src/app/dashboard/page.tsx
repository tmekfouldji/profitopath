import { formatUsdMinor } from '@profitopath/shared';
import Link from 'next/link';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/session';
import { getTraderDashboard } from '@/server/queries';

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  const entries = await getTraderDashboard(user.id);

  return (
    <main className="content-page">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Authoritative account view</p>
          <h1>Trading desk</h1>
        </div>
        <p>
          This view is reconstructed from persisted entries and accounts.
          Closing the browser never closes a position or suspends rule checks.
        </p>
      </header>

      {entries.length === 0 ? (
        <section className="empty-state dashboard-empty">
          <span className="data-label">No active ledger</span>
          <h2>Your first competition account starts with a valid entry.</h2>
          <p>
            Browse the weekly schedule now. Mock checkout and provisioning
            arrive in Phase 3.
          </p>
          <Link className="button button-primary" href="/competitions">
            View competition board
          </Link>
        </section>
      ) : (
        <section className="account-grid">
          {entries.map((entry) => (
            <article className="account-card" key={entry.id}>
              <div className="card-topline">
                <span className="data-label">{entry.tier.code}</span>
                <span
                  className={`status-pill status-${entry.status.toLowerCase()}`}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>
              <h2>{entry.competition.name}</h2>
              <p>
                {formatCompetitionWindow(
                  entry.competition.tradingStartsAt,
                  entry.competition.tradingEndsAt,
                )}
              </p>
              {entry.tradingAccount === null ? (
                <div className="account-pending">
                  Account provisioning pending
                </div>
              ) : (
                <>
                  <div className="balance-block">
                    <span>Balance</span>
                    <strong>
                      {formatUsdMinor(entry.tradingAccount.balanceMinor)}
                    </strong>
                  </div>
                  <Link
                    className="button button-secondary"
                    href={`/terminal/${entry.tradingAccount.id}`}
                  >
                    Open terminal shell
                  </Link>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
