import 'server-only';

import {
  MockPaymentProvider,
  NowPaymentsProvider,
} from '@profitopath/payments';
import { parseRuntimeEnv } from '@profitopath/shared';

const env = parseRuntimeEnv();

export const mockPaymentProvider = new MockPaymentProvider({
  baseUrl: env.NEXTAUTH_URL,
  signingSecret: env.MOCK_PAYMENT_SIGNING_SECRET,
});

const checkoutBaseUrl = env.NEXTAUTH_URL.replace(/\/$/, '');

export const nowPaymentsProvider =
  env.PAYMENT_PROVIDER === 'nowpayments'
    ? new NowPaymentsProvider({
        apiKey: env.NOWPAYMENTS_API_KEY!,
        cancelUrl: `${checkoutBaseUrl}/competitions`,
        ipnCallbackUrl: `${checkoutBaseUrl}/api/payments/nowpayments/ipn`,
        ipnSecret: env.NOWPAYMENTS_IPN_SECRET!,
        successUrl: `${checkoutBaseUrl}/dashboard?notice=payment-submitted`,
      })
    : null;

export const paymentProvider = nowPaymentsProvider ?? mockPaymentProvider;
