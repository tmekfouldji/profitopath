export type PaymentProviderName = 'MOCK' | 'NOWPAYMENTS';

export type PaymentProviderStatus =
  'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export interface CreateCheckoutInput {
  amountMinor: number;
  currency: 'USD';
  idempotencyKey: string;
  referenceId: string;
}

export interface CheckoutSession {
  expiresAt?: Date;
  providerInvoiceId?: string;
  providerPaymentId: string;
  redirectUrl: string;
}

export interface PaymentEvent {
  amountMinor: number;
  currency: 'USD';
  orderReferenceId?: string;
  providerEventId: string;
  provider: PaymentProviderName;
  providerInvoiceId?: string;
  providerPaymentId: string;
  status: PaymentProviderStatus;
}

export interface VerifyCallbackInput {
  body: string;
  headers: Readonly<Record<string, string | undefined>>;
}

export interface PaymentProvider {
  readonly provider: PaymentProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getPayment(providerPaymentId: string): Promise<PaymentEvent>;
  verifyCallback(input: VerifyCallbackInput): Promise<PaymentEvent>;
}

export * from './mock-provider';
export * from './nowpayments-provider';
export * from './payment-service';
