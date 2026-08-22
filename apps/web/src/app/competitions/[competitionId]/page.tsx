import { formatUsdMinor } from '@profitopath/shared';
import { notFound } from 'next/navigation';

import { WeekTape } from '@/components/week-tape';
import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { getCompetition } from '@/server/queries';

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const { competition, tiers } = await getCompetition(competitionId);
  if (competition === null) {
    notFound();
  }

  return (
    <main className="content-page">
      <header className="competition-heading">
        <div>
          <span
            className={`status-pill status-${competition.status.toLowerCase()}`}
          >
            {statusLabel(competition.status)}
          </span>
          <h1>{competition.name}</h1>
          <p>
            {formatCompetitionWindow(
              competition.tradingStartsAt,
              competition.tradingEndsAt,
            )}
          </p>
        </div>
        <div className="heading-stat">
          <span>Registered entries</span>
          <strong>{competition._count.entries}</strong>
        </div>
      </header>

      <section className="week-panel">
        <div>
          <p className="data-label">Competition sequence</p>
          <h2>Five sessions, then a hard freeze.</h2>
          <p>
            Pending orders and risk processing continue server-side throughout
            the configured window. Final leaderboard eligibility is calculated
            after cutoff.
          </p>
        </div>
        <WeekTape activeSession={0} />
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your ledger</p>
            <h2>Competition tiers</h2>
          </div>
          <p>
            Starting balances shown here are configurable development values.
          </p>
        </div>
        <div className="tier-grid">
          {tiers.map((tier) => (
            <article className="tier-card" key={tier.id}>
              <span className="data-label">{tier.code}</span>
              <h3>{tier.name}</h3>
              <strong className="tier-price">
                {formatUsdMinor(tier.entryFeeMinor)}
              </strong>
              <dl>
                <div>
                  <dt>Max drawdown</dt>
                  <dd>{formatUsdMinor(tier.maxDrawdownMinor)}</dd>
                </div>
                <div>
                  <dt>Benchmark</dt>
                  <dd>{formatUsdMinor(tier.performanceBenchmarkMinor)}</dd>
                </div>
                <div>
                  <dt>Dev balance</dt>
                  <dd>{formatUsdMinor(tier.startingBalanceMinor)}</dd>
                </div>
              </dl>
              <button className="button button-disabled" disabled type="button">
                Checkout arrives in Phase 3
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
