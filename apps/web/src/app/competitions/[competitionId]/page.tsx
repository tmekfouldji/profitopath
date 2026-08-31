import { formatUsdMinor } from '@profitopath/shared';
import { notFound } from 'next/navigation';

import { WeekTape } from '@/components/week-tape';
import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { getCompetition } from '@/server/queries';

import { startCheckout } from './actions';

const tierDescriptions: Record<string, string> = {
  ELITE:
    'The widest risk range for traders who want the highest-pressure week.',
  ROOKIE: 'A clear first step for learning the weekly competition rhythm.',
  TRADER: 'A balanced middle tier with more room to build a weekly result.',
};

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ competitionId }, query] = await Promise.all([params, searchParams]);
  const { competition, tiers } = await getCompetition(competitionId);
  if (competition === null) {
    notFound();
  }
  const signupOpen =
    (competition.status === 'SCHEDULED' || competition.status === 'ACTIVE') &&
    new Date() < competition.signupClosesAt;

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

      {query.notice === 'checkout-unavailable' ? (
        <p className="notice-banner notice-error" role="alert">
          This checkout is no longer available. Refresh the competition state or
          choose another open tier.
        </p>
      ) : null}

      {competition.status === 'SCHEDULED' && signupOpen ? (
        <p className="notice-banner" role="status">
          Preorder is open. A completed checkout reserves your tier; simulated
          trading opens with the scheduled competition window.
        </p>
      ) : null}
      {competition.status === 'ACTIVE' && signupOpen ? (
        <p className="notice-banner" role="status">
          Registration is open while this competition is in progress. Complete
          checkout to join the current simulated trading window.
        </p>
      ) : null}

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
            Fees and simulated account rules are set by the published challenge
            tier configuration.
          </p>
        </div>
        <div className="tier-grid">
          {tiers.map((tier) => (
            <article className="tier-card" key={tier.id}>
              <span className="data-label">{tier.code}</span>
              <h3>{tier.name}</h3>
              <p className="tier-description">
                {tierDescriptions[tier.code] ??
                  'A dedicated tier with its own weekly leaderboard.'}
              </p>
              <strong className="tier-price">
                {formatUsdMinor(tier.entryFeeMinor)}
                <small> / weekly entry</small>
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
              <form action={startCheckout}>
                <input
                  name="competitionId"
                  type="hidden"
                  value={competition.id}
                />
                <input name="tierId" type="hidden" value={tier.id} />
                <button
                  className="button button-primary"
                  disabled={!signupOpen}
                  type="submit"
                >
                  {signupOpen
                    ? competition.status === 'SCHEDULED'
                      ? `Preorder ${tier.name}`
                      : `Join ${tier.name}`
                    : 'Entry unavailable'}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
