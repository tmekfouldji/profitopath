import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
  PaymentProviderStatus,
  VerifyCallbackInput,
} from './index';

const signatureHeader = 'x-mock-payment-signature';

interface StoredMockPayment {
  amountMinor: number;
  checkout: CheckoutSession;
  currency: 'USD';
  status: PaymentProviderStatus;
}

export interface MockPaymentProviderOptions {
  baseUrl: string;
  clock?: () => Date;
  signingSecret: string;
}

export interface SignedMockCallback {
  body: string;
  headers: Readonly<Record<string, string>>;
}

export interface CreateSignedMockCallbackInput {
  amountMinor: number;
  currency: 'USD';
  providerPaymentId: string;
  status: PaymentProviderStatus;
}

export class InvalidMockPaymentCallbackError extends Error {
  constructor(message = 'Invalid mock payment callback') {
    super(message);
    this.name = 'InvalidMockPaymentCallbackError';
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isPaymentStatus(value: unknown): value is PaymentProviderStatus {
  return (
    value === 'PENDING' ||
    value === 'CONFIRMED' ||
    value === 'FAILED' ||
    value === 'EXPIRED'
  );
}

export class MockPaymentProvider implements PaymentProvider {
  readonly #baseUrl: string;
  readonly #clock: () => Date;
  readonly #payments = new Map<string, StoredMockPayment>();
  readonly #signingSecret: string;

  constructor(options: MockPaymentProviderOptions) {
    if (options.signingSecret.length < 16) {
      throw new Error(
        'Mock payment signing secret must be at least 16 characters',
      );
    }

    this.#baseUrl = options.baseUrl.replace(/\/$/, '');
    this.#clock = options.clock ?? (() => new Date());
    this.#signingSecret = options.signingSecret;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error('Checkout amount must be a positive safe integer');
    }

    const providerPaymentId = `mock_pay_${digest(input.idempotencyKey).slice(0, 24)}`;
    const existing = this.#payments.get(providerPaymentId);
    if (existing !== undefined) {
      return existing.checkout;
    }

    const checkout = {
      expiresAt: new Date(this.#clock().getTime() + 30 * 60 * 1000),
      providerPaymentId,
      redirectUrl: `${this.#baseUrl}/checkout/mock/${providerPaymentId}`,
    } satisfies CheckoutSession;

    this.#payments.set(providerPaymentId, {
      amountMinor: input.amountMinor,
      checkout,
      currency: input.currency,
      status: 'PENDING',
    });
    return checkout;
  }

  async getPayment(providerPaymentId: string): Promise<PaymentEvent> {
    const payment = this.#payments.get(providerPaymentId);
    if (payment === undefined) {
      throw new Error('Mock payment was not found');
    }

    return {
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      providerEventId: `mock_lookup_${digest(providerPaymentId).slice(0, 24)}`,
      providerPaymentId,
      status: payment.status,
    };
  }

  createSignedCallback(
    input: CreateSignedMockCallbackInput,
  ): SignedMockCallback {
    const providerEventId = `mock_evt_${digest(`${input.providerPaymentId}:${input.status}`).slice(0, 24)}`;
    const body = JSON.stringify({
      amountMinor: input.amountMinor,
      currency: input.currency,
      providerEventId,
      providerPaymentId: input.providerPaymentId,
      status: input.status,
    });

    return {
      body,
      headers: { [signatureHeader]: this.#sign(body) },
    };
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<PaymentEvent> {
    const receivedSignature = input.headers[signatureHeader];
    if (
      receivedSignature === undefined ||
      !this.#matchesSignature(input.body, receivedSignature)
    ) {
      throw new InvalidMockPaymentCallbackError();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(input.body) as unknown;
    } catch {
      throw new InvalidMockPaymentCallbackError();
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('amountMinor' in payload) ||
      typeof payload.amountMinor !== 'number' ||
      !Number.isSafeInteger(payload.amountMinor) ||
      !('currency' in payload) ||
      payload.currency !== 'USD' ||
      !('providerEventId' in payload) ||
      typeof payload.providerEventId !== 'string' ||
      !('providerPaymentId' in payload) ||
      typeof payload.providerPaymentId !== 'string' ||
      !('status' in payload) ||
      !isPaymentStatus(payload.status)
    ) {
      throw new InvalidMockPaymentCallbackError();
    }

    const payment = this.#payments.get(payload.providerPaymentId);
    if (payment !== undefined) {
      payment.status = payload.status;
    }

    return {
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      providerEventId: payload.providerEventId,
      providerPaymentId: payload.providerPaymentId,
      status: payload.status,
    };
  }

  #matchesSignature(body: string, received: string): boolean {
    const expected = Buffer.from(this.#sign(body), 'hex');
    const candidate = Buffer.from(received, 'hex');
    return (
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate)
    );
  }

  #sign(body: string): string {
    return createHmac('sha256', this.#signingSecret).update(body).digest('hex');
  }
}
