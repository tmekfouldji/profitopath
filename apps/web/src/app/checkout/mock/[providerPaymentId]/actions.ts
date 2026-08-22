'use server';

import { database } from '@profitopath/database';
import {
  hashPaymentEvent,
  processVerifiedPaymentEvent,
} from '@profitopath/payments';
import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@/server/auth/session';
import { mockPaymentProvider } from '@/server/payments';

export async function confirmMockPayment(formData: FormData): Promise<never> {
  const providerPaymentId = String(formData.get('providerPaymentId') ?? '');
  const callbackUrl = `/checkout/mock/${encodeURIComponent(providerPaymentId)}`;
  const user = await requireUser(callbackUrl);
  const payment = await database.payment.findFirst({
    where: { providerPaymentId, userId: user.id },
  });
  if (payment === null || payment.providerPaymentId === null) {
    notFound();
  }

  const signedCallback = mockPaymentProvider.createSignedCallback({
    amountMinor: payment.amountMinor,
    currency: 'USD',
    providerPaymentId: payment.providerPaymentId,
    status: 'CONFIRMED',
  });
  const event = await mockPaymentProvider.verifyCallback(signedCallback);
  await processVerifiedPaymentEvent({
    event,
    payloadHash: hashPaymentEvent(event),
  });

  redirect('/dashboard?notice=mock-payment-confirmed');
}
