import Link from 'next/link';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { listCompetitions } from '@/server/queries';

export default async function CompetitionsPage() {
  const competitions = await listCompetitions();

  return (
    <main className="content-page">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Weekly schedule / UTC</p>
          <h1>Competition board</h1>
        </div>
        <p>
          Every week has a fixed trading window, independent tier leaderboards,
          and a final server-side freeze.
        </p>
      </header>

      {competitions.length === 0 ? (
        <section className="empty-state">
          <span className="data-label">Schedule clear</span>
          <h2>No competition has been scheduled.</h2>
          <p>
            Run the development seed or ask an administrator to publish the next
            week.
          </p>
        </section>
      ) : (
        <section className="competition-list">
          {competitions.map((competition) => (
            <Link
              className="competition-row"
              href={`/competitions/${competition.id}`}
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
              <div className="row-stat">
                <span>Entries</span>
                <strong>{competition._count.entries}</strong>
              </div>
              <span className="row-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
