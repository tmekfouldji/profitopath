import Link from 'next/link';

import { formatUsdMinor } from '@profitopath/shared';

import { WeekTape } from '@/components/week-tape';
import { listActiveChallengeTiers } from '@/server/queries';

export default async function Home() {
  const tiers = await listActiveChallengeTiers();
  return (
    <main className="home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Weekly simulated trading / UTC</p>
          <h1>
            One week to prove
            <br />
            how you trade.
          </h1>
          <p className="hero-intro">
            Join a five-session competition, trade fictitious capital in a real
            browser terminal, and climb a tier-specific leaderboard. Your
            positions, risk checks, and score keep running on the server—even
            after you close the tab.
          </p>
          <div className="action-row">
            <Link className="button button-primary" href="/competitions">
              Find your competition
            </Link>
            <Link className="button button-secondary" href="/leaderboards">
              See the standings
            </Link>
          </div>
          <div aria-label="Platform assurances" className="hero-assurances">
            <span>Simulated only</span>
            <span>Server-enforced rules</span>
            <span>Auditable results</span>
          </div>
        </div>
        <aside className="hero-ledger" aria-label="Weekly competition flow">
          <div className="hero-ledger-head">
            <div>
              <p className="data-label">The competition week</p>
              <strong>Five sessions. One result.</strong>
            </div>
            <span className="status-pill status-active">Illustration</span>
          </div>
          <WeekTape activeSession={0} />
          <div className="hero-ledger-flow">
            <div>
              <span>Before Monday</span>
              <strong>Choose a tier</strong>
            </div>
            <div>
              <span>During the week</span>
              <strong>Trade and manage risk</strong>
            </div>
            <div>
              <span>At cutoff</span>
              <strong>Score is frozen</strong>
            </div>
          </div>
          <p className="ledger-note">
            <span className="status-dot" aria-hidden="true" />
            Risk processing and pending orders remain active while you are
            offline.
          </p>
        </aside>
      </section>

      <section className="home-section home-process">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">From entry to final board</p>
            <h2>A complete competition in four clear moves.</h2>
          </div>
          <p>
            The platform is built around one repeatable rhythm. Every action is
            attached to a specific week, tier, and authoritative account.
          </p>
        </div>
        <div className="process-grid">
          <article>
            <span>01 / Enter</span>
            <strong>Pick your level</strong>
            <p>Choose Rookie, Trader, or Elite for one scheduled week.</p>
          </article>
          <article>
            <span>02 / Trade</span>
            <strong>Work from the terminal</strong>
            <p>Place market, limit, and stop orders with persistent SL/TP.</p>
          </article>
          <article>
            <span>03 / Protect</span>
            <strong>Stay inside the rules</strong>
            <p>Equity, margin, and drawdown are evaluated on the server.</p>
          </article>
          <article>
            <span>04 / Finish</span>
            <strong>Make the final board</strong>
            <p>
              Eligible scores freeze at cutoff and remain available to audit.
            </p>
          </article>
        </div>
      </section>

      <section className="home-section tier-preview-section">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Three ways onto the grid</p>
            <h2>Choose the pressure that fits.</h2>
          </div>
          <Link className="section-link" href="/competitions">
            Compare the next week <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {tiers.length === 0 ? (
          <p className="tier-preview-note">
            Challenge tiers will appear here once the next preorder offering is
            published.
          </p>
        ) : (
          <div className="home-tier-grid">
            {tiers.map((tier, index) => (
              <article
                className={index === 1 ? 'is-featured' : undefined}
                key={tier.id}
              >
                <span className="tier-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="data-label">{tier.name}</p>
                <h3>{formatUsdMinor(tier.entryFeeMinor)} entry</h3>
                <p>
                  Simulated starting balance{' '}
                  {formatUsdMinor(tier.startingBalanceMinor)}
                  {' · '}maximum drawdown{' '}
                  {formatUsdMinor(tier.maxDrawdownMinor)}.
                </p>
                <strong>
                  {formatUsdMinor(tier.performanceBenchmarkMinor)} benchmark
                </strong>
              </article>
            ))}
          </div>
        )}
        <p className="tier-preview-note">
          Entry fees and simulated thresholds are shown from the active tier
          configuration. A confirmed purchase is one competition entry—not a
          funded account, customer balance, or deposit.
        </p>
      </section>

      <section aria-label="Platform principles" className="principle-strip">
        <article>
          <span>01 / Execution</span>
          <strong>Practice without pretending.</strong>
          <p>No customer capital is routed to a broker or live market.</p>
        </article>
        <article>
          <span>02 / Continuity</span>
          <strong>Your week does not live in a tab.</strong>
          <p>Orders, positions, breaches, and history persist on the server.</p>
        </article>
        <article>
          <span>03 / Result</span>
          <strong>A finish you can inspect.</strong>
          <p>Eligible performance is frozen, reviewed, and ranked by tier.</p>
        </article>
      </section>
    </main>
  );
}
