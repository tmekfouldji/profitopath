import { formatUsdMinor } from '@profitopath/shared';
import { notFound, redirect } from 'next/navigation';

import { formatCompetitionWindow, statusLabel } from '@/lib/format';
import { requireUser } from '@/server/auth/session';
import { getOwnedMockPayment } from '@/server/queries';

import { confirmMockPayment } from './actions';

export default async function MockCheckoutPage({
  params,
}: {
  params: Promise<{ providerPaymentId: string }>;
}) {
  const { providerPaymentId } = await params;
  const user = await requireUser(
    `/checkout/mock/${encodeURIComponent(providerPaymentId)}`,
  );
  const payment = await getOwnedMockPayment(providerPaymentId, user.id);
  if (payment === null || payment.competitionEntry === null) {
    notFound();
  }
  if (payment.status === 'CONFIRMED') {
    redirect('/dashboard?notice=entry-already-active');
  }

  const entry = payment.competitionEntry;
  const payable = payment.status === 'PENDING';

  return (
    <main className="content-page checkout-page">
      <header className="page-heading split-heading">
        <div>
          <p className="eyebrow">Simulation checkout</p>
          <h1>Confirm your weekly entry</h1>
        </div>
        <span className={`status-pill status-${payment.status.toLowerCase()}`}>
          {statusLabel(payment.status)}
        </span>
      </header>

      <section className="checkout-grid">
        <article className="checkout-summary">
          <span className="data-label">Order summary</span>
          <h2>{entry.tier.name}</h2>
          <p>{entry.competition.name}</p>
          <p>
            {formatCompetitionWindow(
              entry.competition.tradingStartsAt,
              entry.competition.tradingEndsAt,
            )}
          </p>
          <dl>
            <div>
              <dt>Mock charge</dt>
              <dd>{formatUsdMinor(payment.amountMinor)}</dd>
            </div>
            <div>
              <dt>Fictitious capital</dt>
              <dd>{formatUsdMinor(entry.tier.startingBalanceMinor)}</dd>
            </div>
          </dl>
        </article>

        <article className="checkout-confirmation">
          <span className="data-label">Local development provider</span>
          <h2>No real payment will be taken.</h2>
          <p>
            This button produces a signed mock provider event. Confirmation
            activates one simulated account with fictitious capital; it is not a
            deposit and cannot be withdrawn.
          </p>
          <form action={confirmMockPayment}>
            <input
              name="providerPaymentId"
              type="hidden"
              value={providerPaymentId}
            />
            <button
              className={
                payable ? 'button button-primary' : 'button button-disabled'
              }
              disabled={!payable}
              type="submit"
            >
              Confirm mock payment
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
