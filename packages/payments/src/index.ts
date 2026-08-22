export type PaymentProviderStatus =
  'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';

export interface CreateCheckoutInput {
  amountMinor: number;
  currency: 'USD';
  idempotencyKey: string;
  referenceId: string;
}

export interface CheckoutSession {
  expiresAt: Date;
  providerPaymentId: string;
  redirectUrl: string;
}

export interface PaymentEvent {
  providerEventId: string;
  providerPaymentId: string;
  status: PaymentProviderStatus;
}

export interface VerifyCallbackInput {
  body: string;
  headers: Readonly<Record<string, string | undefined>>;
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getPayment(providerPaymentId: string): Promise<PaymentEvent>;
  verifyCallback(input: VerifyCallbackInput): Promise<PaymentEvent>;
}
