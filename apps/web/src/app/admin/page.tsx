import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireAdmin } from '@/server/auth/session';
import { getAdminOverview } from '@/server/queries';

import {
  archiveCompetitionAction,
  disqualifyEntryAction,
  finalizeLeaderboardAction,
  recomputeLeaderboardAction,
  runDueLifecycleAction,
} from './actions';

const notices: Record<string, { error?: boolean; message: string }> = {
  'competition-archived': {
    message: 'Competition archived with an audit record.',
  },
  'competition-unchanged': { message: 'Competition was already archived.' },
  'entry-disqualified': {
    message: 'Entry disqualified and removed from eligible standings.',
  },
  'entry-unchanged': { message: 'Entry was already disqualified.' },
  'invalid-operation': {
    error: true,
    message:
      'The requested state change is not valid from the current authoritative state.',
  },
  'leaderboard-finalized': {
    message: 'Leaderboard finalized and its canonical hash persisted.',
  },
  'leaderboard-recomputed': {
    message: 'Authoritative leaderboard recomputed and audited.',
  },
  'leaderboard-unchanged': {
    message: 'The immutable leaderboard already matches its recompute.',
  },
  'lifecycle-noop': {
    message: 'No competition was due for activation or cutoff.',
  },
  'lifecycle-processed': {
    message: 'Due competition lifecycle work completed.',
  },
  'operation-failed': {
    error: true,
    message: 'The operation failed without changing authoritative state.',
  },
};

function entryName(entry: {
  id: string;
  user: { displayName: string | null; email: string; name: string | null };
}): string {
  return (
    entry.user.displayName?.trim() ||
    entry.user.name?.trim() ||
    entry.user.email ||
    `Trader-${entry.id.slice(0, 8)}`
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireAdmin();
  const [overview, params] = await Promise.all([
    getAdminOverview(),
    searchParams,
  ]);
  const notice =
    params.notice === undefined ? undefined : notices[params.notice];

  return (
    <main className="content-page">
      <header className="page-heading split-heading admin-heading">
        <div>
          <p className="eyebrow">Restricted operations</p>
          <h1>Weekly control room</h1>
        </div>
        <div className="admin-heading-copy">
          <p>
            Drive due UTC windows, review eligible entries, and seal one
            authoritative result. Every state mutation is server-authorized and
            audited.
          </p>
          <form action={runDueLifecycleAction}>
            <button className="button button-primary" type="submit">
              Run due lifecycle
            </button>
          </form>
        </div>
      </header>

      {notice === undefined ? null : (
        <p
          className={`notice-banner${notice.error === true ? ' notice-error' : ''}`}
          role="status"
        >
          {notice.message}
        </p>
      )}

      <section className="metric-grid">
        <article>
          <span>Users</span>
          <strong>{overview.users}</strong>
        </article>
        <article>
          <span>Competitions</span>
          <strong>{overview.competitions}</strong>
        </article>
        <article>
          <span>Active accounts</span>
          <strong>{overview.activeAccounts}</strong>
        </article>
        <article>
          <span>Pending payments</span>
          <strong>{overview.pendingPayments}</strong>
        </article>
      </section>

      <section className="admin-competition-board">
        <div className="section-heading">
          <div>
            <p className="eyebrow">UTC window ledger</p>
            <h2>Competition control</h2>
          </div>
          <p>
            Recompute reads PostgreSQL only. Finalization is available after
            cutoff freeze.
          </p>
        </div>
        {overview.managedCompetitions.length === 0 ? (
          <p className="empty-copy">
            No competition requires operational control.
          </p>
        ) : (
          <div className="admin-competition-list">
            {overview.managedCompetitions.map((competition) => (
              <article className="admin-competition" key={competition.id}>
                <header>
                  <div>
                    <span className="data-label">{competition.code}</span>
                    <h3>{competition.name}</h3>
                  </div>
                  <span
                    className={`status-pill status-${competition.status.toLowerCase()}`}
                  >
                    {statusLabel(competition.status)}
                  </span>
                </header>
                <div className="competition-window-rail">
                  <span>
                    {formatCompetitionWindow(
                      competition.tradingStartsAt,
                      competition.tradingEndsAt,
                    )}
                  </span>
                  <i aria-hidden="true" />
                  <code>
                    {competition.finalization?.resultHash.slice(0, 16) ??
                      'result not sealed'}
                  </code>
                </div>
                <div className="admin-action-row">
                  {['ACTIVE', 'FROZEN', 'FINALIZED'].includes(
                    competition.status,
                  ) ? (
                    <form action={recomputeLeaderboardAction}>
                      <input
                        name="competitionId"
                        type="hidden"
                        value={competition.id}
                      />
                      <button className="button button-secondary" type="submit">
                        Recompute
                      </button>
                    </form>
                  ) : null}
                  {competition.status === 'FROZEN' ? (
                    <form action={finalizeLeaderboardAction}>
                      <input
                        name="competitionId"
                        type="hidden"
                        value={competition.id}
                      />
                      <button className="button button-primary" type="submit">
                        Finalize result
                      </button>
                    </form>
                  ) : null}
                  {['FINALIZED', 'CANCELLED'].includes(competition.status) ? (
                    <form
                      action={archiveCompetitionAction}
                      className="admin-inline-form"
                    >
                      <input
                        name="competitionId"
                        type="hidden"
                        value={competition.id}
                      />
                      <input
                        aria-label="Archive reason"
                        maxLength={1000}
                        minLength={3}
                        name="reason"
                        placeholder="Archive reason"
                        required
                      />
                      <button className="button button-secondary" type="submit">
                        Archive
                      </button>
                    </form>
                  ) : null}
                </div>
                {competition.entries.length === 0 ? (
                  <p className="empty-copy">
                    No entries have been provisioned.
                  </p>
                ) : (
                  <div className="admin-entry-list">
                    {competition.entries.map((entry) => (
                      <div className="admin-entry-row" key={entry.id}>
                        <div>
                          <strong>{entryName(entry)}</strong>
                          <span>{entry.tier.code}</span>
                        </div>
                        <code>{statusLabel(entry.status)}</code>
                        {['ACTIVE', 'FROZEN'].includes(competition.status) &&
                        ['ACTIVE', 'COMPLETED'].includes(entry.status) ? (
                          <form
                            action={disqualifyEntryAction}
                            className="admin-review-form"
                          >
                            <input
                              name="entryId"
                              type="hidden"
                              value={entry.id}
                            />
                            <input
                              aria-label={`Reason to disqualify ${entryName(entry)}`}
                              maxLength={1000}
                              minLength={3}
                              name="reason"
                              placeholder="Required review reason"
                              required
                            />
                            <button type="submit">Disqualify</button>
                          </form>
                        ) : (
                          <span>
                            {entry.tradingAccount === null
                              ? 'No account'
                              : statusLabel(entry.tradingAccount.status)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="audit-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Mock provider operations</p>
            <h2>Recent payments</h2>
          </div>
        </div>
        {overview.recentPayments.length === 0 ? (
          <p className="empty-copy">No payment attempts have been recorded.</p>
        ) : (
          <div className="payment-list">
            {overview.recentPayments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <span>{payment.user.email}</span>
                <strong>{payment.competitionEntry?.tier.code ?? '—'}</strong>
                <span>{statusLabel(payment.status)}</span>
                <span>
                  {payment.competitionEntry?.tradingAccount === null ||
                  payment.competitionEntry === null
                    ? 'Not provisioned'
                    : 'Account active'}
                </span>
                <code>
                  {payment.providerPaymentId?.slice(0, 18) ?? 'reserved'}
                </code>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="audit-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Append-only evidence</p>
            <h2>Recent audit events</h2>
          </div>
        </div>
        {overview.recentAudit.length === 0 ? (
          <p className="empty-copy">No audit events have been recorded.</p>
        ) : (
          <div className="audit-list">
            {overview.recentAudit.map((event) => (
              <div className="audit-row" key={event.id}>
                <span>{event.createdAt.toISOString()}</span>
                <strong>{statusLabel(event.action)}</strong>
                <span>{event.entityType}</span>
                <code>{event.entityId.slice(0, 12)}</code>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
