import { formatUsdMinor } from '@profitopath/shared';

import { requireSuperadmin } from '@/server/auth/session';
import { getSuperadminChallengeTiers } from '@/server/queries';

import {
  createChallengeTierAction,
  setChallengeTierAvailabilityAction,
  updateChallengeTierAction,
} from '../actions';

const notices: Record<string, { error?: boolean; message: string }> = {
  'invalid-operation': {
    error: true,
    message:
      'That pricing change is not valid. Tiers with entries are intentionally immutable.',
  },
  'operation-failed': {
    error: true,
    message: 'The operation failed without changing authoritative state.',
  },
  'tier-created': {
    message: 'New simulated challenge tier created and enabled.',
  },
  'tier-disabled': { message: 'Tier disabled for new checkouts.' },
  'tier-enabled': { message: 'Tier enabled for new checkouts.' },
  'tier-updated': { message: 'Unused tier pricing and rules were updated.' },
};

function usdInputValue(value: bigint | number): string {
  const minor = BigInt(value);
  const whole = minor / 100n;
  const cents = (minor % 100n).toString().padStart(2, '0');
  return `${whole}.${cents}`;
}

export default async function ChallengePricingPage({
  searchParams,
}: {
  searchParams: Promise<{ detail?: string; notice?: string }>;
}) {
  await requireSuperadmin();
  const [tiers, params] = await Promise.all([
    getSuperadminChallengeTiers(),
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
          <p className="eyebrow">Product configuration</p>
          <h1>Challenge pricing</h1>
        </div>
        <p>
          Active tiers are offered in every scheduled competition. Once a tier
          has an entry, its money and rule configuration is locked forever—make
          a new version instead of rewriting a paid customer record.
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
            <p className="eyebrow">New price version</p>
            <h2>Create a challenge tier</h2>
          </div>
          <p>
            USD is the configured checkout-price currency. All balances are
            simulated.
          </p>
        </div>
        <form
          action={createChallengeTierAction}
          className="superadmin-form-grid"
        >
          <label>
            Tier code
            <input
              maxLength={32}
              name="code"
              pattern="[A-Za-z0-9_-]+"
              placeholder="ROOKIE_V2"
              required
            />
          </label>
          <label>
            Public name
            <input maxLength={80} name="name" placeholder="Rookie" required />
          </label>
          <label>
            Entry fee (USD)
            <input
              min="0.01"
              name="entryFeeUsd"
              placeholder="10.00"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Simulated starting balance (USD)
            <input
              min="0.01"
              name="startingBalanceUsd"
              placeholder="10000.00"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Maximum drawdown (USD)
            <input
              min="0"
              name="maxDrawdownUsd"
              placeholder="1000.00"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Performance benchmark (USD)
            <input
              min="0"
              name="performanceBenchmarkUsd"
              placeholder="2000.00"
              required
              step="0.01"
              type="number"
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
          <button className="button button-primary" type="submit">
            Create and enable tier
          </button>
        </form>
      </section>

      <section className="superadmin-list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Price ledger</p>
            <h2>Configured challenge tiers</h2>
          </div>
          <p>
            Disabling a tier removes it from new checkout choices but keeps any
            historical customer entry intact.
          </p>
        </div>
        {tiers.length === 0 ? (
          <p className="empty-copy">No challenge tiers have been created.</p>
        ) : (
          <div className="superadmin-record-list">
            {tiers.map((tier) => {
              const locked = tier._count.entries > 0;
              return (
                <article className="superadmin-record" key={tier.id}>
                  <header>
                    <div>
                      <span
                        className={`status-pill status-${tier.active ? 'active' : 'archived'}`}
                      >
                        {tier.active ? 'Available' : 'Unavailable'}
                      </span>
                      <h3>{tier.name}</h3>
                      <code>{tier.code}</code>
                    </div>
                    <dl className="superadmin-record-meta">
                      <div>
                        <dt>Entry fee</dt>
                        <dd>{formatUsdMinor(tier.entryFeeMinor)}</dd>
                      </div>
                      <div>
                        <dt>Entries</dt>
                        <dd>{tier._count.entries}</dd>
                      </div>
                      <div>
                        <dt>Rules</dt>
                        <dd>v{tier.rulesVersion}</dd>
                      </div>
                    </dl>
                  </header>
                  <dl className="superadmin-tier-values">
                    <div>
                      <dt>Simulated balance</dt>
                      <dd>{formatUsdMinor(tier.startingBalanceMinor)}</dd>
                    </div>
                    <div>
                      <dt>Maximum drawdown</dt>
                      <dd>{formatUsdMinor(tier.maxDrawdownMinor)}</dd>
                    </div>
                    <div>
                      <dt>Benchmark</dt>
                      <dd>{formatUsdMinor(tier.performanceBenchmarkMinor)}</dd>
                    </div>
                  </dl>
                  {locked ? (
                    <p className="superadmin-record-note">
                      Locked: this tier already has {tier._count.entries} entry
                      record
                      {tier._count.entries === 1 ? '' : 's'}. Create a new tier
                      code to publish a new price or rule version.
                    </p>
                  ) : (
                    <form
                      action={updateChallengeTierAction}
                      className="superadmin-form-grid compact"
                    >
                      <input name="tierId" type="hidden" value={tier.id} />
                      <label>
                        Public name
                        <input
                          defaultValue={tier.name}
                          maxLength={80}
                          name="name"
                          required
                        />
                      </label>
                      <label>
                        Entry fee (USD)
                        <input
                          defaultValue={usdInputValue(tier.entryFeeMinor)}
                          min="0.01"
                          name="entryFeeUsd"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        Simulated balance (USD)
                        <input
                          defaultValue={usdInputValue(
                            tier.startingBalanceMinor,
                          )}
                          min="0.01"
                          name="startingBalanceUsd"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        Maximum drawdown (USD)
                        <input
                          defaultValue={usdInputValue(tier.maxDrawdownMinor)}
                          min="0"
                          name="maxDrawdownUsd"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        Benchmark (USD)
                        <input
                          defaultValue={usdInputValue(
                            tier.performanceBenchmarkMinor,
                          )}
                          min="0"
                          name="performanceBenchmarkUsd"
                          required
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        Rules version
                        <input
                          defaultValue={tier.rulesVersion}
                          min="1"
                          name="rulesVersion"
                          required
                          type="number"
                        />
                      </label>
                      <button type="submit">Save unused tier</button>
                    </form>
                  )}
                  <form
                    action={setChallengeTierAvailabilityAction}
                    className="superadmin-availability-form"
                  >
                    <input name="tierId" type="hidden" value={tier.id} />
                    <input
                      name="active"
                      type="hidden"
                      value={tier.active ? 'false' : 'true'}
                    />
                    <input
                      aria-label={`Reason to ${tier.active ? 'disable' : 'enable'} ${tier.name}`}
                      maxLength={1000}
                      minLength={3}
                      name="reason"
                      placeholder={`Reason to ${tier.active ? 'disable' : 'enable'}`}
                      required
                    />
                    <button type="submit">
                      {tier.active
                        ? 'Disable new checkout'
                        : 'Enable new checkout'}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
