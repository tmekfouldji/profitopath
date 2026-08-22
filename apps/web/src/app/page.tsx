import Link from 'next/link';

import { WeekTape } from '@/components/week-tape';

export default function Home() {
  return (
    <main className="home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Five sessions. One final ledger.</p>
          <h1>
            Trade the week.
            <br />
            Keep the score honest.
          </h1>
          <p className="hero-intro">
            A server-owned simulated trading competition where positions survive
            your browser, rules keep running, and every weekly result can be
            audited.
          </p>
          <div className="action-row">
            <Link className="button button-primary" href="/register">
              Create trading profile
            </Link>
            <Link className="button button-secondary" href="/competitions">
              Inspect competitions
            </Link>
          </div>
        </div>
        <aside className="hero-ledger">
          <p className="data-label">Competition clock / UTC</p>
          <WeekTape activeSession={0} />
          <div className="ledger-note">
            <span className="status-dot" />
            <span>
              Positions and drawdown remain server-owned while you are offline.
            </span>
          </div>
        </aside>
      </section>
      <section aria-label="Platform principles" className="principle-strip">
        <article>
          <span>Execution</span>
          <strong>Simulated only</strong>
          <p>No customer capital is routed to a broker or live market.</p>
        </article>
        <article>
          <span>Truth</span>
          <strong>Server-owned</strong>
          <p>
            Orders, positions, breaches, and history persist independently of
            the browser.
          </p>
        </article>
        <article>
          <span>Outcome</span>
          <strong>Weekly freeze</strong>
          <p>
            Eligible performance is frozen, reviewed, and ranked by competition
            tier.
          </p>
        </article>
      </section>
    </main>
  );
}
