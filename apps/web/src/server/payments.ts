import 'server-only';

import { MockPaymentProvider } from '@profitopath/payments';
import { parseRuntimeEnv } from '@profitopath/shared';

const env = parseRuntimeEnv();

export const mockPaymentProvider = new MockPaymentProvider({
  baseUrl: env.NEXTAUTH_URL,
  signingSecret: env.MOCK_PAYMENT_SIGNING_SECRET,
});
