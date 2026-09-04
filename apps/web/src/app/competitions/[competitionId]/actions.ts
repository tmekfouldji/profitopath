'use server';

import {
  CheckoutUnavailableError,
  createCompetitionCheckout,
  PaymentEventConflictError,
} from '@profitopath/payments';
import { redirect } from 'next/navigation';

import { requireUser } from '@/server/auth/session';
import { paymentProvider } from '@/server/payments';
import {
  assertTwelveDataTrialAccess,
  TwelveDataTrialStaffAccessError,
} from '@/server/twelve-data-trial-access';

export async function startCheckout(formData: FormData): Promise<never> {
  const competitionId = String(formData.get('competitionId') ?? '');
  const tierId = String(formData.get('tierId') ?? '');
  const callbackUrl = `/competitions/${encodeURIComponent(competitionId)}`;
  const user = await requireUser(callbackUrl);

  try {
    assertTwelveDataTrialAccess(user);
    const result = await createCompetitionCheckout(
      { competitionId, tierId, userId: user.id },
      paymentProvider,
    );
    redirect(result.checkout.redirectUrl);
  } catch (error) {
    if (
      error instanceof CheckoutUnavailableError ||
      error instanceof PaymentEventConflictError ||
      error instanceof TwelveDataTrialStaffAccessError
    ) {
      redirect(`${callbackUrl}?notice=checkout-unavailable`);
    }
    throw error;
  }
}
