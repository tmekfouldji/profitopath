'use server';

import {
  CheckoutUnavailableError,
  createCompetitionCheckout,
  PaymentEventConflictError,
} from '@profitopath/payments';
import { redirect } from 'next/navigation';

import { requireUser } from '@/server/auth/session';
import { mockPaymentProvider } from '@/server/payments';

export async function startMockCheckout(formData: FormData): Promise<never> {
  const competitionId = String(formData.get('competitionId') ?? '');
  const tierId = String(formData.get('tierId') ?? '');
  const callbackUrl = `/competitions/${encodeURIComponent(competitionId)}`;
  const user = await requireUser(callbackUrl);

  try {
    const result = await createCompetitionCheckout(
      { competitionId, tierId, userId: user.id },
      mockPaymentProvider,
    );
    redirect(result.checkout.redirectUrl);
  } catch (error) {
    if (
      error instanceof CheckoutUnavailableError ||
      error instanceof PaymentEventConflictError
    ) {
      redirect(`${callbackUrl}?notice=checkout-unavailable`);
    }
    throw error;
  }
}
