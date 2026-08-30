import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
  PaymentProviderStatus,
  VerifyCallbackInput,
} from './index';

const nowPaymentsApiUrl = 'https://api.nowpayments.io/v1';
const signatureHeader = 'x-nowpayments-sig';

interface NowPaymentsInvoiceResponse {
  id: unknown;
  invoice_url: unknown;
}

interface NowPaymentsPaymentPayload {
  invoice_id?: unknown;
  order_id?: unknown;
  payment_id?: unknown;
  payment_status?: unknown;
  price_amount?: unknown;
  price_currency?: unknown;
}

export interface NowPaymentsProviderOptions {
  apiKey: string;
  cancelUrl: string;
  fetch?: typeof fetch;
  ipnCallbackUrl: string;
  ipnSecret: string;
  successUrl: string;
}

export class InvalidNowPaymentsCallbackError extends Error {
  constructor(message = 'Invalid NOWPayments callback') {
    super(message);
    this.name = 'InvalidNowPaymentsCallbackError';
  }
}

export class NowPaymentsApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`NOWPayments API request failed with status ${status}`);
    this.name = 'NowPaymentsApiError';
    this.status = status;
  }
}

function formatUsdMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Checkout amount must be a positive safe integer');
  }
  const whole = Math.floor(amountMinor / 100);
  const fraction = String(amountMinor % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function parseIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new InvalidNowPaymentsCallbackError(`${field} is missing`);
  }
  const identifier = String(value).trim();
  if (identifier.length === 0 || identifier.length > 128) {
    throw new InvalidNowPaymentsCallbackError(`${field} is invalid`);
  }
  return identifier;
}

function parseUsdMinor(value: unknown): number {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : undefined;
  if (text === undefined) {
    throw new InvalidNowPaymentsCallbackError('price_amount is invalid');
  }
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (match === null) {
    throw new InvalidNowPaymentsCallbackError(
      'price_amount is not USD-cent exact',
    );
  }
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const minor = BigInt(match[1]!) * 100n + BigInt(fraction || '0');
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidNowPaymentsCallbackError(
      'price_amount is outside the supported range',
    );
  }
  return Number(minor);
}

function paymentStatus(value: unknown): PaymentProviderStatus {
  switch (value) {
    case 'waiting':
    case 'confirming':
    case 'confirmed':
    case 'sending':
    case 'partially_paid':
      return 'PENDING';
    case 'finished':
      return 'CONFIRMED';
    case 'failed':
      return 'FAILED';
    case 'expired':
      return 'EXPIRED';
    case 'refunded':
      return 'REFUNDED';
    default:
      throw new InvalidNowPaymentsCallbackError(
        'payment_status is unsupported',
      );
  }
}

function sortedPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedPayload);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortedPayload((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

function parseCallbackPayload(body: string): NowPaymentsPaymentPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    throw new InvalidNowPaymentsCallbackError('callback body is not JSON');
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new InvalidNowPaymentsCallbackError('callback body is invalid');
  }
  return payload as NowPaymentsPaymentPayload;
}

function parseEvent(payload: NowPaymentsPaymentPayload): PaymentEvent {
  if (String(payload.price_currency ?? '').toUpperCase() !== 'USD') {
    throw new InvalidNowPaymentsCallbackError('price_currency must be USD');
  }
  const providerPaymentId = parseIdentifier(payload.payment_id, 'payment_id');
  const rawStatus = parseIdentifier(payload.payment_status, 'payment_status');
  return {
    amountMinor: parseUsdMinor(payload.price_amount),
    currency: 'USD',
    ...(payload.order_id === null || payload.order_id === undefined
      ? {}
      : { orderReferenceId: parseIdentifier(payload.order_id, 'order_id') }),
    providerEventId: `nowpayments:${providerPaymentId}:${rawStatus}`,
    provider: 'NOWPAYMENTS',
    ...(payload.invoice_id === null || payload.invoice_id === undefined
      ? {}
      : {
          providerInvoiceId: parseIdentifier(payload.invoice_id, 'invoice_id'),
        }),
    providerPaymentId,
    status: paymentStatus(rawStatus),
  };
}

function isTrustedInvoiceUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'nowpayments.io' ||
        url.hostname.endsWith('.nowpayments.io'))
    );
  } catch {
    return false;
  }
}

export class NowPaymentsProvider implements PaymentProvider {
  readonly provider = 'NOWPAYMENTS' as const;
  readonly #apiKey: string;
  readonly #cancelUrl: string;
  readonly #fetch: typeof fetch;
  readonly #ipnCallbackUrl: string;
  readonly #ipnSecret: string;
  readonly #successUrl: string;

  constructor(options: NowPaymentsProviderOptions) {
    if (
      options.apiKey.trim().length === 0 ||
      options.ipnSecret.trim().length === 0
    ) {
      throw new Error('NOWPayments API and IPN credentials are required');
    }
    for (const [name, value] of Object.entries({
      cancelUrl: options.cancelUrl,
      ipnCallbackUrl: options.ipnCallbackUrl,
      successUrl: options.successUrl,
    })) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname === 'localhost') {
        throw new Error(`${name} must be a public HTTPS URL`);
      }
    }
    this.#apiKey = options.apiKey;
    this.#cancelUrl = options.cancelUrl;
    this.#fetch = options.fetch ?? fetch;
    this.#ipnCallbackUrl = options.ipnCallbackUrl;
    this.#ipnSecret = options.ipnSecret;
    this.#successUrl = options.successUrl;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const response = await this.#fetch(`${nowPaymentsApiUrl}/invoice`, {
      body: JSON.stringify({
        cancel_url: this.#cancelUrl,
        ipn_callback_url: this.#ipnCallbackUrl,
        order_description: 'Profitopath weekly simulated competition entry',
        order_id: input.referenceId,
        price_amount: formatUsdMinor(input.amountMinor),
        price_currency: input.currency.toLowerCase(),
        success_url: this.#successUrl,
      }),
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.#apiKey,
      },
      method: 'POST',
    });
    if (!response.ok) {
      throw new NowPaymentsApiError(response.status);
    }
    const payload = (await response.json()) as NowPaymentsInvoiceResponse;
    if (!isTrustedInvoiceUrl(payload.invoice_url)) {
      throw new NowPaymentsApiError(response.status);
    }
    return {
      providerInvoiceId: parseIdentifier(payload.id, 'invoice id'),
      providerPaymentId: parseIdentifier(payload.id, 'invoice id'),
      redirectUrl: payload.invoice_url,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentEvent> {
    const response = await this.#fetch(
      `${nowPaymentsApiUrl}/payment/${encodeURIComponent(providerPaymentId)}`,
      { headers: { 'x-api-key': this.#apiKey } },
    );
    if (!response.ok) {
      throw new NowPaymentsApiError(response.status);
    }
    const payload = (await response.json()) as NowPaymentsPaymentPayload;
    return parseEvent(payload);
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<PaymentEvent> {
    const receivedSignature = input.headers[signatureHeader];
    if (
      receivedSignature === undefined ||
      !this.#matchesSignature(input.body, receivedSignature)
    ) {
      throw new InvalidNowPaymentsCallbackError();
    }
    return parseEvent(parseCallbackPayload(input.body));
  }

  #matchesSignature(body: string, received: string): boolean {
    const payload = parseCallbackPayload(body);
    const expected = Buffer.from(
      createHmac('sha512', this.#ipnSecret)
        .update(JSON.stringify(sortedPayload(payload)))
        .digest('hex'),
      'hex',
    );
    const candidate = Buffer.from(received, 'hex');
    return (
      /^[a-f\d]{128}$/i.test(received) &&
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate)
    );
  }
}
