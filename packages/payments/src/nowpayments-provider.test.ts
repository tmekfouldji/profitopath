import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  InvalidNowPaymentsCallbackError,
  NowPaymentsApiError,
  NowPaymentsProvider,
} from './nowpayments-provider';

const callbackUrl =
  'https://profitopath.example.test/api/payments/nowpayments/ipn';
const ipnSecret = 'nowpayments-ipn-secret-for-tests';

function sortPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortPayload);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortPayload((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

function signedCallback(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha512', ipnSecret)
    .update(JSON.stringify(sortPayload(payload)))
    .digest('hex');
  return { body, headers: { 'x-nowpayments-sig': signature } };
}

function provider(fetch = vi.fn<typeof globalThis.fetch>()) {
  return new NowPaymentsProvider({
    apiKey: 'nowpayments-api-key-for-tests',
    cancelUrl: 'https://profitopath.example.test/competitions',
    fetch,
    ipnCallbackUrl: callbackUrl,
    ipnSecret,
    successUrl:
      'https://profitopath.example.test/dashboard?notice=payment-submitted',
  });
}

describe('NowPaymentsProvider', () => {
  it('creates a server-owned hosted invoice with exact USD cents and callback correlation', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'invoice-123',
          invoice_url: 'https://nowpayments.io/payment/?iid=invoice-123',
        }),
        { status: 201 },
      ),
    );
    const paymentProvider = provider(fetch);

    await expect(
      paymentProvider.createCheckout({
        amountMinor: 505,
        currency: 'USD',
        idempotencyKey: 'unused-by-nowpayments-api',
        referenceId: 'local-payment-id',
      }),
    ).resolves.toEqual({
      providerInvoiceId: 'invoice-123',
      providerPaymentId: 'invoice-123',
      redirectUrl: 'https://nowpayments.io/payment/?iid=invoice-123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.nowpayments.io/v1/invoice',
      expect.objectContaining({
        body: JSON.stringify({
          cancel_url: 'https://profitopath.example.test/competitions',
          ipn_callback_url: callbackUrl,
          order_description: 'Profitopath weekly simulated competition entry',
          order_id: 'local-payment-id',
          price_amount: '5.05',
          price_currency: 'usd',
          success_url:
            'https://profitopath.example.test/dashboard?notice=payment-submitted',
        }),
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'nowpayments-api-key-for-tests',
        },
        method: 'POST',
      }),
    );
  });

  it('fails closed when the invoice response is not a trusted hosted URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'invoice-123',
          invoice_url: 'https://example.test/pay',
        }),
        { status: 201 },
      ),
    );

    await expect(
      provider(fetch).createCheckout({
        amountMinor: 500,
        currency: 'USD',
        idempotencyKey: 'checkout',
        referenceId: 'local-payment-id',
      }),
    ).rejects.toBeInstanceOf(NowPaymentsApiError);
  });

  it('verifies a recursively sorted signed IPN and maps only finished to confirmation', async () => {
    const paymentProvider = provider();
    const callback = signedCallback({
      fee: { currency: 'usdttrc20', depositFee: 0 },
      invoice_id: 'invoice-123',
      order_id: 'local-payment-id',
      payment_id: 123456,
      payment_status: 'finished',
      price_amount: '5.00',
      price_currency: 'usd',
    });

    await expect(paymentProvider.verifyCallback(callback)).resolves.toEqual({
      amountMinor: 500,
      currency: 'USD',
      orderReferenceId: 'local-payment-id',
      providerEventId: 'nowpayments:123456:finished',
      provider: 'NOWPAYMENTS',
      providerInvoiceId: 'invoice-123',
      providerPaymentId: '123456',
      status: 'CONFIRMED',
    });

    const partial = signedCallback({
      order_id: 'local-payment-id',
      payment_id: 123456,
      payment_status: 'partially_paid',
      price_amount: 5,
      price_currency: 'usd',
    });
    await expect(
      paymentProvider.verifyCallback(partial),
    ).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('rejects a callback with a missing or invalid signature before parsing payment state', async () => {
    const paymentProvider = provider();
    const callback = signedCallback({
      payment_id: 123456,
      payment_status: 'finished',
      price_amount: 5,
      price_currency: 'usd',
    });

    await expect(
      paymentProvider.verifyCallback({
        body: callback.body,
        headers: { 'x-nowpayments-sig': 'not-a-signature' },
      }),
    ).rejects.toBeInstanceOf(InvalidNowPaymentsCallbackError);
  });
});
