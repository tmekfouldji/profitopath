import { formatUsdMinor } from '@profitopath/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import {
  getPublicLeaderboard,
  type PublicLeaderboardView,
} from '@/server/public-leaderboards';

const modeCopy: Record<PublicLeaderboardView['mode'], string> = {
  CUTOFF_REVIEW:
    'Cutoff inputs are frozen. Administrative review remains open before the result is sealed.',
  FINAL:
    'This view is reconstructed from immutable final standing rows and the retained result hash.',
  LIVE: 'Ranks are recomputed from PostgreSQL account snapshots and breach state on each request.',
};

function utcMoment(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(value);
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  let leaderboard: PublicLeaderboardView | null;
  try {
    leaderboard = await getPublicLeaderboard(competitionId);
  } catch {
    return (
      <main className="content-page">
        <section className="empty-state">
          <span className="data-label">Authoritative view unavailable</span>
          <h1>Standings are being reconciled.</h1>
          <p>
            The server did not publish a partial result. Try again after cutoff
            processing completes.
          </p>
          <Link className="button button-secondary" href="/leaderboards">
            Return to standings
          </Link>
        </section>
      </main>
    );
  }
  if (leaderboard === null) notFound();

  return (
    <main className="content-page">
      <header className="leaderboard-heading">
        <div>
          <span
            className={`status-pill status-${leaderboard.competition.status.toLowerCase()}`}
          >
            {statusLabel(leaderboard.competition.status)}
          </span>
          <p className="eyebrow">{leaderboard.competition.code}</p>
          <h1>{leaderboard.competition.name}</h1>
          <p>
            {formatCompetitionWindow(
              leaderboard.competition.tradingStartsAt,
              leaderboard.competition.tradingEndsAt,
            )}
          </p>
        </div>
        <dl className="leaderboard-proof">
          <div>
            <dt>Authoritative as of</dt>
            <dd>{utcMoment(leaderboard.asOf)}</dd>
          </div>
          <div>
            <dt>Ranking policy</dt>
            <dd>Development v{leaderboard.policyVersion}</dd>
          </div>
          <div>
            <dt>Rules version</dt>
            <dd>v{leaderboard.rulesVersion}</dd>
          </div>
          <div>
            <dt>Result hash</dt>
            <dd title={leaderboard.resultHash ?? undefined}>
              {leaderboard.resultHash?.slice(0, 20) ?? 'Not sealed'}
            </dd>
          </div>
        </dl>
      </header>

      <p className="leaderboard-mode-note">
        <span aria-hidden="true" />
        {modeCopy[leaderboard.mode]}
      </p>

      <div className="leaderboard-tier-stack">
        {leaderboard.tiers.length === 0 ? (
          <section className="empty-state">
            <span className="data-label">No provisioned tiers</span>
            <h2>No eligible standings are available.</h2>
          </section>
        ) : (
          leaderboard.tiers.map((tier) => (
            <section className="leaderboard-tier" key={tier.id}>
              <header>
                <div>
                  <p className="data-label">{tier.code}</p>
                  <h2>{tier.name}</h2>
                </div>
                <span>{tier.standings.length} eligible</span>
              </header>
              {tier.standings.length === 0 ? (
                <p className="leaderboard-empty-tier">
                  No eligible entry has an authoritative score in this tier.
                </p>
              ) : (
                <div className="leaderboard-table" role="table">
                  <div className="leaderboard-table-head" role="row">
                    <span role="columnheader">Rank</span>
                    <span role="columnheader">Trader</span>
                    <span role="columnheader">Performance</span>
                    <span role="columnheader">Max drawdown</span>
                    <span role="columnheader">Equity</span>
                  </div>
                  {tier.standings.map((standing) => (
                    <div
                      className="leaderboard-table-row"
                      key={`${tier.id}-${standing.displayOrder}`}
                      role="row"
                    >
                      <strong role="cell">
                        {standing.isTied ? 'T' : '#'}
                        {standing.rank}
                      </strong>
                      <span role="cell">{standing.displayName}</span>
                      <code
                        className={
                          standing.netPerformanceMinor < 0n
                            ? 'is-negative'
                            : 'is-positive'
                        }
                        role="cell"
                      >
                        {standing.netPerformanceMinor > 0n ? '+' : ''}
                        {formatUsdMinor(standing.netPerformanceMinor)}
                      </code>
                      <code role="cell">
                        {formatUsdMinor(standing.maxObservedDrawdownMinor)}
                      </code>
                      <code role="cell">
                        {formatUsdMinor(standing.equityMinor)}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </main>
  );
}
