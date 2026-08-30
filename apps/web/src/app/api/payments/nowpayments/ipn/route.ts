import {
  InvalidNowPaymentsCallbackError,
  PaymentEventConflictError,
  hashPaymentEvent,
  processVerifiedPaymentEvent,
} from '@profitopath/payments';
import { InvalidStateTransitionError } from '@profitopath/competition';
import { NextResponse } from 'next/server';

import { nowPaymentsProvider } from '@/server/payments';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (nowPaymentsProvider === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await request.text();
  try {
    const event = await nowPaymentsProvider.verifyCallback({
      body,
      headers: {
        'x-nowpayments-sig':
          request.headers.get('x-nowpayments-sig') ?? undefined,
      },
    });
    await processVerifiedPaymentEvent({
      event,
      payloadHash: hashPaymentEvent(event),
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      error instanceof InvalidNowPaymentsCallbackError ||
      error instanceof PaymentEventConflictError ||
      error instanceof InvalidStateTransitionError
    ) {
      return NextResponse.json(
        { error: 'invalid_payment_notification' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'payment_notification_unavailable' },
      { status: 503 },
    );
  }
}
