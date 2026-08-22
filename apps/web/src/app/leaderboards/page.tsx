import Link from 'next/link';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { listPublicLeaderboardCompetitions } from '@/server/public-leaderboards';

export default async function LeaderboardsPage() {
  const competitions = await listPublicLeaderboardCompetitions();
  const current = competitions.filter(
    (competition) => competition.status !== 'ARCHIVED',
  );
  const archived = competitions.filter(
    (competition) => competition.status === 'ARCHIVED',
  );

  return (
    <main className="content-page">
      <header className="page-heading split-heading leaderboard-index-heading">
        <div>
          <p className="eyebrow">Server-ranked / tier-separated</p>
          <h1>Weekly standings</h1>
        </div>
        <p>
          Live ranks come from persisted account valuations. Sealed weeks remain
          available with their immutable result hash and UTC cutoff.
        </p>
      </header>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Open and sealed windows</p>
            <h2>Current board</h2>
          </div>
        </div>
        {current.length === 0 ? (
          <div className="empty-state">
            <span className="data-label">No active week</span>
            <h2>Standings will appear when trading starts.</h2>
            <p>Archived immutable results remain listed below.</p>
          </div>
        ) : (
          <div className="leaderboard-week-list">
            {current.map((competition) => (
              <Link
                className="leaderboard-week-row"
                href={`/leaderboards/${competition.id}`}
                key={competition.id}
              >
                <span
                  className={`status-pill status-${competition.status.toLowerCase()}`}
                >
                  {statusLabel(competition.status)}
                </span>
                <div>
                  <strong>{competition.name}</strong>
                  <span>
                    {formatCompetitionWindow(
                      competition.tradingStartsAt,
                      competition.tradingEndsAt,
                    )}
                  </span>
                </div>
                <code>{competition._count.entries} entries</code>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="leaderboard-archive">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Retained evidence</p>
            <h2>Archive</h2>
          </div>
          <p>Archived weeks render only their persisted final standings.</p>
        </div>
        {archived.length === 0 ? (
          <p className="empty-copy">No competition has been archived yet.</p>
        ) : (
          <div className="leaderboard-week-list is-archive">
            {archived.map((competition) => (
              <Link
                className="leaderboard-week-row"
                href={`/leaderboards/${competition.id}`}
                key={competition.id}
              >
                <span className="status-pill">Archived</span>
                <div>
                  <strong>{competition.name}</strong>
                  <span>
                    {formatCompetitionWindow(
                      competition.tradingStartsAt,
                      competition.tradingEndsAt,
                    )}
                  </span>
                </div>
                <code>{competition._count.entries} entries</code>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
