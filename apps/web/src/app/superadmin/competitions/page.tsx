import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminCompetitionSetup } from '@/server/queries';

import {
  cancelCompetitionDraftAction,
  createCompetitionDraftAction,
  publishCompetitionDraftAction,
  updateCompetitionDraftAction,
} from '../actions';

const notices: Record<string, { error?: boolean; message: string }> = {
  'competition-cancelled': { message: 'The unpublished draft was cancelled.' },
  'competition-created': {
    message: 'Competition draft created. Review it, then publish preorder.',
  },
  'competition-published': {
    message: 'Preorder is live for this validated UTC competition window.',
  },
  'competition-updated': { message: 'Competition draft schedule was updated.' },
  'invalid-operation': {
    error: true,
    message: 'That change is not valid for the current authoritative state.',
  },
  'operation-failed': {
    error: true,
    message: 'The operation failed without changing authoritative state.',
  },
};

function utcInputValue(value: Date): string {
  return value.toISOString().slice(0, 16);
}

export default async function SuperadminCompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ detail?: string; notice?: string }>;
}) {
  await requireSuperadmin();
  const [competitions, params] = await Promise.all([
    getSuperadminCompetitionSetup(),
    searchParams,
  ]);
  const notice =
    params.notice === undefined ? undefined : notices[params.notice];
  const noticeDetail =
    notice?.error === true && params.detail !== undefined
      ? params.detail.slice(0, 240)
      : undefined;

  return (
    <section className="superadmin-section">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Competition scheduling</p>
          <h1>Competitions</h1>
        </div>
        <p>
          Create a future weekly competition as a draft, verify its UTC window,
          then explicitly publish it for preorder. Published timing is retained
          as part of the authoritative competition record.
        </p>
      </header>

      {notice === undefined ? null : (
        <p
          className={`notice-banner${notice.error === true ? ' notice-error' : ''}`}
          role="status"
        >
          {notice.message}
          {noticeDetail === undefined ? null : ` ${noticeDetail}`}
        </p>
      )}

      <section className="superadmin-form-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Create a competition draft</h2>
          </div>
          <p>All three times are interpreted as UTC.</p>
        </div>
        <form
          action={createCompetitionDraftAction}
          className="superadmin-form-grid"
        >
          <label>
            Competition code
            <input
              maxLength={64}
              name="code"
              pattern="[A-Za-z0-9_-]+"
              placeholder="WEEK-20260915"
              required
            />
          </label>
          <label>
            Public name
            <input
              maxLength={120}
              name="name"
              placeholder="September 15 Weekly"
              required
            />
          </label>
          <label>
            Rules version
            <input
              defaultValue="1"
              min="1"
              name="rulesVersion"
              required
              type="number"
            />
          </label>
          <label>
            Signup closes (UTC)
            <input name="signupClosesAt" required type="datetime-local" />
          </label>
          <label>
            Trading starts (UTC)
            <input name="tradingStartsAt" required type="datetime-local" />
          </label>
          <label>
            Trading ends (UTC)
            <input name="tradingEndsAt" required type="datetime-local" />
          </label>
          <button className="button button-primary" type="submit">
            Create draft
          </button>
        </form>
      </section>

      <section className="superadmin-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Authoritative schedule</p>
            <h2>Competition ledger</h2>
          </div>
          <p>
            A draft remains private. A scheduled competition becomes
            preorder-visible using every active challenge tier.
          </p>
        </div>
        {competitions.length === 0 ? (
          <p className="empty-copy">No competition records yet.</p>
        ) : (
          <div className="superadmin-record-list">
            {competitions.map((competition) => (
              <article className="superadmin-record" key={competition.id}>
                <header>
                  <div>
                    <span
                      className={`status-pill status-${competition.status.toLowerCase()}`}
                    >
                      {statusLabel(competition.status)}
                    </span>
                    <h3>{competition.name}</h3>
                    <code>{competition.code}</code>
                  </div>
                  <dl className="superadmin-record-meta">
                    <div>
                      <dt>Entries</dt>
                      <dd>{competition._count.entries}</dd>
                    </div>
                    <div>
                      <dt>Prizes</dt>
                      <dd>{competition._count.prizes}</dd>
                    </div>
                    <div>
                      <dt>Rules</dt>
                      <dd>v{competition.rulesVersion}</dd>
                    </div>
                  </dl>
                </header>
                <p>
                  {formatCompetitionWindow(
                    competition.tradingStartsAt,
                    competition.tradingEndsAt,
                  )}
                </p>
                <p className="superadmin-record-note">
                  Signup closes{' '}
                  {competition.signupClosesAt
                    .toISOString()
                    .replace('T', ' ')
                    .slice(0, 16)}{' '}
                  UTC
                </p>
                {competition.status === 'DRAFT' ? (
                  <div className="superadmin-draft-controls">
                    <form
                      action={updateCompetitionDraftAction}
                      className="superadmin-form-grid compact"
                    >
                      <input
                        name="competitionId"
                        type="hidden"
                        value={competition.id}
                      />
                      <label>
                        Public name
                        <input
                          defaultValue={competition.name}
                          maxLength={120}
                          name="name"
                          required
                        />
                      </label>
                      <label>
                        Rules version
                        <input
                          defaultValue={competition.rulesVersion}
                          min="1"
                          name="rulesVersion"
                          required
                          type="number"
                        />
                      </label>
                      <label>
                        Signup closes (UTC)
                        <input
                          defaultValue={utcInputValue(
                            competition.signupClosesAt,
                          )}
                          name="signupClosesAt"
                          required
                          type="datetime-local"
                        />
                      </label>
                      <label>
                        Trading starts (UTC)
                        <input
                          defaultValue={utcInputValue(
                            competition.tradingStartsAt,
                          )}
                          name="tradingStartsAt"
                          required
                          type="datetime-local"
                        />
                      </label>
                      <label>
                        Trading ends (UTC)
                        <input
                          defaultValue={utcInputValue(
                            competition.tradingEndsAt,
                          )}
                          name="tradingEndsAt"
                          required
                          type="datetime-local"
                        />
                      </label>
                      <button type="submit">Save draft</button>
                    </form>
                    <div className="superadmin-inline-actions">
                      <form action={publishCompetitionDraftAction}>
                        <input
                          name="competitionId"
                          type="hidden"
                          value={competition.id}
                        />
                        <button className="button button-primary" type="submit">
                          Publish preorder
                        </button>
                      </form>
                      <form
                        action={cancelCompetitionDraftAction}
                        className="superadmin-danger-form"
                      >
                        <input
                          name="competitionId"
                          type="hidden"
                          value={competition.id}
                        />
                        <input
                          aria-label="Draft cancellation reason"
                          maxLength={1000}
                          minLength={3}
                          name="reason"
                          placeholder="Cancellation reason"
                          required
                        />
                        <button type="submit">Cancel draft</button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
