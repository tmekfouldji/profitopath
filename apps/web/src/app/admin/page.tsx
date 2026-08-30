import { formatUsdMinor } from '@profitopath/shared';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireAdmin } from '@/server/auth/session';
import { getAdminOverview } from '@/server/queries';

import {
  approvePayoutAction,
  approvePrizeAction,
  archiveCompetitionAction,
  cancelManualPayoutAction,
  derivePrizeLedgerAction,
  disqualifyEntryAction,
  finalizeLeaderboardAction,
  markManualPayoutPaidAction,
  reconcileManualPayoutAction,
  recordManualPayoutFailureAction,
  recomputeLeaderboardAction,
  reviewPrizeWinnerAction,
  runDueLifecycleAction,
  startManualPayoutAction,
  updatePrizeKycAction,
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
  'kyc-updated': {
    message: 'Manual KYC state and review evidence were recorded.',
  },
  'payout-approved': {
    message: 'A second administrator approved the exact payout ledger row.',
  },
  'payout-cancelled': {
    message: 'The unpaid payout was cancelled and its prize was voided.',
  },
  'payout-failed': {
    message: 'The failed manual payout attempt was retained for review.',
  },
  'payout-paid': {
    message: 'Manual payment evidence and transaction reference were recorded.',
  },
  'payout-processing': {
    message: 'The approved payout is now marked as manually processing.',
  },
  'payout-reconciled': {
    message:
      'A second reviewer reconciled the payout and issued configured credits.',
  },
  'prize-approved': {
    message:
      'The reviewed company-funded prize was approved and a pending payout created.',
  },
  'prizes-derived': {
    message: 'Configured prize rows were bound to immutable final standings.',
  },
  'prizes-unresolved': {
    message:
      'Prize derivation completed with ranks held for manual policy review.',
  },
  'winner-confirmed': {
    message: 'The derived winner was confirmed with audit evidence.',
  },
  'winner-rejected': {
    message: 'The derived winner and prize were rejected with audit evidence.',
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

      <section className="admin-prize-board" id="payout-operations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Company-funded award ledger</p>
            <h2>Prize operations</h2>
          </div>
          <p>
            Development amounts are preconfigured, never calculated here.
            Payment, KYC, and reconciliation are manual audited records; no
            provider or customer balance is connected.
          </p>
        </div>
        {overview.prizeOperations.length === 0 ? (
          <p className="empty-copy">
            No configured prize rows exist. The platform will not invent prize
            economics.
          </p>
        ) : (
          <div className="admin-prize-list">
            {overview.prizeOperations.map((prize) => {
              const winner = prize.winnerEntry;
              const payout = prize.payout;
              return (
                <article className="admin-prize" key={prize.id}>
                  <header>
                    <div>
                      <span className="data-label">
                        {prize.competition.code} · {prize.tier.code} · rank{' '}
                        {prize.rank}
                      </span>
                      <h3>{formatUsdMinor(prize.amountMinor)}</h3>
                    </div>
                    <span
                      className={`status-pill status-${prize.status.toLowerCase()}`}
                    >
                      {statusLabel(prize.status)}
                    </span>
                  </header>
                  <dl className="admin-prize-proof">
                    <div>
                      <dt>Winner</dt>
                      <dd>
                        {winner === null ? 'Unresolved' : entryName(winner)}
                      </dd>
                    </div>
                    <div>
                      <dt>Winner review</dt>
                      <dd>{statusLabel(prize.winnerReviewStatus)}</dd>
                    </div>
                    <div>
                      <dt>Manual KYC</dt>
                      <dd>{statusLabel(prize.kycStatus)}</dd>
                    </div>
                    <div>
                      <dt>Payout</dt>
                      <dd>
                        {payout === null
                          ? 'Not created'
                          : statusLabel(payout.status)}
                      </dd>
                    </div>
                    <div>
                      <dt>Final result</dt>
                      <dd>
                        {prize.sourceResultHash?.slice(0, 16) ?? 'Not derived'}
                      </dd>
                    </div>
                    <div>
                      <dt>Free entries</dt>
                      <dd>
                        {prize.issuedFreeEntryCredits.length}/
                        {prize.freeEntryCredits} issued
                      </dd>
                    </div>
                  </dl>
                  {prize.reviewReason === null ? null : (
                    <p className="admin-prize-note">{prize.reviewReason}</p>
                  )}
                  <div className="admin-prize-actions">
                    {prize.sourceFinalizationId === null ? (
                      <form
                        action={derivePrizeLedgerAction}
                        className="admin-prize-command"
                      >
                        <input
                          name="competitionId"
                          type="hidden"
                          value={prize.competitionId}
                        />
                        <input
                          aria-label="Prize derivation reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Derivation reason"
                          required
                        />
                        <button type="submit">Derive sealed winners</button>
                      </form>
                    ) : null}
                    {winner !== null &&
                    prize.winnerReviewStatus === 'PENDING' ? (
                      <>
                        <form
                          action={reviewPrizeWinnerAction}
                          className="admin-prize-command"
                        >
                          <input
                            name="prizeId"
                            type="hidden"
                            value={prize.id}
                          />
                          <input
                            name="decision"
                            type="hidden"
                            value="CONFIRM"
                          />
                          <input
                            aria-label="Winner confirmation reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Winner evidence"
                            required
                          />
                          <button type="submit">Confirm winner</button>
                        </form>
                        <form
                          action={reviewPrizeWinnerAction}
                          className="admin-prize-command is-danger"
                        >
                          <input
                            name="prizeId"
                            type="hidden"
                            value={prize.id}
                          />
                          <input name="decision" type="hidden" value="REJECT" />
                          <input
                            aria-label="Winner rejection reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Rejection evidence"
                            required
                          />
                          <button type="submit">Reject winner</button>
                        </form>
                      </>
                    ) : null}
                    {prize.winnerReviewStatus === 'CONFIRMED' &&
                    ['NOT_STARTED', 'REJECTED'].includes(prize.kycStatus) ? (
                      <form
                        action={updatePrizeKycAction}
                        className="admin-prize-command"
                      >
                        <input name="prizeId" type="hidden" value={prize.id} />
                        <input name="kycStatus" type="hidden" value="PENDING" />
                        <input
                          aria-label="KYC opening reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="KYC review evidence"
                          required
                        />
                        <button type="submit">Open KYC review</button>
                      </form>
                    ) : null}
                    {prize.kycStatus === 'PENDING' ? (
                      <>
                        <form
                          action={updatePrizeKycAction}
                          className="admin-prize-command"
                        >
                          <input
                            name="prizeId"
                            type="hidden"
                            value={prize.id}
                          />
                          <input
                            name="kycStatus"
                            type="hidden"
                            value="APPROVED"
                          />
                          <input
                            aria-label="KYC approval reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Compliance evidence"
                            required
                          />
                          <button type="submit">Approve KYC</button>
                        </form>
                        <form
                          action={updatePrizeKycAction}
                          className="admin-prize-command is-danger"
                        >
                          <input
                            name="prizeId"
                            type="hidden"
                            value={prize.id}
                          />
                          <input
                            name="kycStatus"
                            type="hidden"
                            value="REJECTED"
                          />
                          <input
                            aria-label="KYC rejection reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Compliance reason"
                            required
                          />
                          <button type="submit">Reject KYC</button>
                        </form>
                      </>
                    ) : null}
                    {prize.status === 'PENDING_REVIEW' &&
                    prize.winnerReviewStatus === 'CONFIRMED' &&
                    prize.kycStatus === 'APPROVED' ? (
                      <form
                        action={approvePrizeAction}
                        className="admin-prize-command"
                      >
                        <input name="prizeId" type="hidden" value={prize.id} />
                        <input
                          aria-label="Prize approval reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Prize approval evidence"
                          required
                        />
                        <button type="submit">Approve prize</button>
                      </form>
                    ) : null}
                    {payout?.status === 'PENDING' ? (
                      <form
                        action={approvePayoutAction}
                        className="admin-prize-command"
                      >
                        <input
                          name="payoutId"
                          type="hidden"
                          value={payout.id}
                        />
                        <input
                          aria-label="Payout approval reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Second-admin evidence"
                          required
                        />
                        <button type="submit">Approve payout</button>
                      </form>
                    ) : null}
                    {payout !== null &&
                    ['APPROVED', 'FAILED'].includes(payout.status) ? (
                      <form
                        action={startManualPayoutAction}
                        className="admin-prize-command"
                      >
                        <input
                          name="payoutId"
                          type="hidden"
                          value={payout.id}
                        />
                        <input
                          aria-label="Payout processing reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Manual transfer note"
                          required
                        />
                        <button type="submit">
                          {payout.status === 'FAILED'
                            ? 'Retry payout'
                            : 'Start payout'}
                        </button>
                      </form>
                    ) : null}
                    {payout?.status === 'PROCESSING' ? (
                      <>
                        <form
                          action={markManualPayoutPaidAction}
                          className="admin-prize-command is-wide"
                        >
                          <input
                            name="payoutId"
                            type="hidden"
                            value={payout.id}
                          />
                          <input
                            aria-label="Transaction reference"
                            maxLength={255}
                            minLength={6}
                            name="transactionReference"
                            placeholder="Transaction reference"
                            required
                          />
                          <input
                            aria-label="Payout completion reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Completion evidence"
                            required
                          />
                          <button type="submit">Record paid</button>
                        </form>
                        <form
                          action={recordManualPayoutFailureAction}
                          className="admin-prize-command is-danger"
                        >
                          <input
                            name="payoutId"
                            type="hidden"
                            value={payout.id}
                          />
                          <input
                            aria-label="Payout failure reason"
                            maxLength={1000}
                            minLength={3}
                            name="reason"
                            placeholder="Failure evidence"
                            required
                          />
                          <button type="submit">Record failed</button>
                        </form>
                      </>
                    ) : null}
                    {payout !== null &&
                    ['PENDING', 'APPROVED', 'FAILED'].includes(
                      payout.status,
                    ) ? (
                      <form
                        action={cancelManualPayoutAction}
                        className="admin-prize-command is-danger"
                      >
                        <input
                          name="payoutId"
                          type="hidden"
                          value={payout.id}
                        />
                        <input
                          aria-label="Payout cancellation reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Cancellation evidence"
                          required
                        />
                        <button type="submit">Cancel payout</button>
                      </form>
                    ) : null}
                    {payout?.status === 'PAID' &&
                    payout.reconciledAt === null ? (
                      <form
                        action={reconcileManualPayoutAction}
                        className="admin-prize-command"
                      >
                        <input
                          name="payoutId"
                          type="hidden"
                          value={payout.id}
                        />
                        <input
                          aria-label="Payout reconciliation note"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Second-review evidence"
                          required
                        />
                        <button type="submit">Reconcile payout</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
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
