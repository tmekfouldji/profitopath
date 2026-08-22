import { formatUsdMinor } from '@profitopath/shared';
import Link from 'next/link';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/session';
import { getTraderDashboard } from '@/server/queries';
import { getTraderLeaderboardSummaries } from '@/server/trader-leaderboards';

function leaderboardAsOf(value: Date | null): string {
  if (value === null) return 'Awaiting valuation';
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(value)} UTC`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const [entries, leaderboardSummaries, params] = await Promise.all([
    getTraderDashboard(user.id),
    getTraderLeaderboardSummaries(user.id),
    searchParams,
  ]);

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

      {params.notice === 'mock-payment-confirmed' ? (
        <p className="notice-banner" role="status">
          Mock payment confirmed. Your simulated account was provisioned from
          the authoritative ledger.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <section className="empty-state dashboard-empty">
          <span className="data-label">No active ledger</span>
          <h2>Your first competition account starts with a valid entry.</h2>
          <p>
            Select a tier and complete the local mock checkout to provision one.
          </p>
          <Link className="button button-primary" href="/competitions">
            View competition board
          </Link>
        </section>
      ) : (
        <section className="account-grid">
          {entries.map((entry) => {
            const leaderboard = leaderboardSummaries.get(entry.id);
            return (
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
                {leaderboard === undefined ? null : (
                  <div className="trader-leaderboard-summary">
                    <div className="trader-rank-line">
                      <span>
                        {leaderboard.eligible
                          ? leaderboard.rank === null
                            ? 'Eligible · rank pending'
                            : leaderboard.isTied
                              ? `Tied rank ${leaderboard.rank}`
                              : `Rank ${leaderboard.rank}`
                          : statusLabel(leaderboard.eligibility)}
                      </span>
                      <strong>
                        {leaderboard.rank === null
                          ? '—'
                          : `${leaderboard.isTied ? 'T' : '#'}${leaderboard.rank}`}
                      </strong>
                    </div>
                    <dl>
                      <div>
                        <dt>Performance</dt>
                        <dd>
                          {leaderboard.netPerformanceMinor === null
                            ? '—'
                            : formatUsdMinor(leaderboard.netPerformanceMinor)}
                        </dd>
                      </div>
                      <div>
                        <dt>Max drawdown</dt>
                        <dd>
                          {leaderboard.maxObservedDrawdownMinor === null
                            ? '—'
                            : formatUsdMinor(
                                leaderboard.maxObservedDrawdownMinor,
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>As of</dt>
                        <dd>{leaderboardAsOf(leaderboard.asOf)}</dd>
                      </div>
                    </dl>
                    {['ACTIVE', 'FROZEN', 'FINALIZED', 'ARCHIVED'].includes(
                      leaderboard.competitionStatus,
                    ) ? (
                      <Link
                        className="trader-leaderboard-link"
                        href={`/leaderboards/${leaderboard.competitionId}`}
                      >
                        View tier standings ↗
                      </Link>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
