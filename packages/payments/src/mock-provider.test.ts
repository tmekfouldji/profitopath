import { describe, expect, it } from 'vitest';

import {
  InvalidMockPaymentCallbackError,
  MockPaymentProvider,
} from './mock-provider';

const options = {
  baseUrl: 'https://payments.example.test/',
  clock: () => new Date('2026-08-22T12:00:00.000Z'),
  signingSecret: 'test-signing-secret-value',
};

describe('MockPaymentProvider', () => {
  it('creates an idempotent deterministic checkout', async () => {
    const provider = new MockPaymentProvider(options);
    const input = {
      amountMinor: 500,
      currency: 'USD' as const,
      idempotencyKey: 'checkout:user:competition:rookie',
      referenceId: 'payment-id',
    };

    const first = await provider.createCheckout(input);
    const second = await provider.createCheckout(input);

    expect(second).toEqual(first);
    expect(first.providerPaymentId).toMatch(/^mock_pay_[a-f0-9]{24}$/);
    expect(first.redirectUrl).toContain(first.providerPaymentId);
    expect(first.expiresAt).toEqual(new Date('2026-08-22T12:30:00.000Z'));
  });

  it.each(['CONFIRMED', 'FAILED', 'EXPIRED'] as const)(
    'verifies a signed %s callback and updates lookup state',
    async (status) => {
      const provider = new MockPaymentProvider(options);
      const checkout = await provider.createCheckout({
        amountMinor: 1_000,
        currency: 'USD',
        idempotencyKey: `checkout-${status}`,
        referenceId: 'payment-id',
      });
      const callback = provider.createSignedCallback({
        amountMinor: 1_000,
        currency: 'USD',
        providerPaymentId: checkout.providerPaymentId,
        status,
      });

      await expect(provider.verifyCallback(callback)).resolves.toMatchObject({
        providerPaymentId: checkout.providerPaymentId,
        status,
      });
      await expect(
        provider.getPayment(checkout.providerPaymentId),
      ).resolves.toMatchObject({ status });
    },
  );

  it('rejects a callback with an invalid signature', async () => {
    const provider = new MockPaymentProvider(options);
    const checkout = await provider.createCheckout({
      amountMinor: 500,
      currency: 'USD',
      idempotencyKey: 'invalid-signature',
      referenceId: 'payment-id',
    });
    const callback = provider.createSignedCallback({
      amountMinor: 500,
      currency: 'USD',
      providerPaymentId: checkout.providerPaymentId,
      status: 'FAILED',
    });

    await expect(
      provider.verifyCallback({
        body: callback.body,
        headers: { 'x-mock-payment-signature': 'bad-signature' },
      }),
    ).rejects.toBeInstanceOf(InvalidMockPaymentCallbackError);
  });
});
