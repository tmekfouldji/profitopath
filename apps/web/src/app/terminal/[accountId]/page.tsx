import { formatUsdMinor } from '@profitopath/shared';
import { notFound } from 'next/navigation';

import { statusLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/session';
import { getOwnedAccount } from '@/server/queries';

export default async function TerminalPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const user = await requireUser(`/terminal/${accountId}`);
  const account = await getOwnedAccount(accountId, user.id);
  if (account === null) {
    notFound();
  }

  return (
    <main className="terminal-page">
      <header className="terminal-bar">
        <div>
          <span className="data-label">
            {account.competitionEntry.tier.code}
          </span>
          <strong>{account.competitionEntry.competition.name}</strong>
        </div>
        <dl>
          <div>
            <dt>Balance</dt>
            <dd>{formatUsdMinor(account.balanceMinor)}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{statusLabel(account.status)}</dd>
          </div>
        </dl>
      </header>
      <section className="terminal-grid">
        <div className="chart-placeholder">
          <span className="data-label">Chart workspace / Phase 6</span>
          <div className="chart-horizon" aria-hidden="true" />
          <h1>Terminal boundary established.</h1>
          <p>
            Quotes, charts, and order submission are intentionally absent. This
            route proves authenticated account ownership without making the
            browser authoritative.
          </p>
        </div>
        <aside className="order-placeholder">
          <span className="data-label">Order ticket</span>
          <label>
            Symbol
            <input disabled placeholder="Unavailable" />
          </label>
          <label>
            Quantity
            <input disabled placeholder="0.00" />
          </label>
          <button className="button button-disabled" disabled type="button">
            Simulator arrives in Phase 4
          </button>
        </aside>
      </section>
    </main>
  );
}
