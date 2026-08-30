import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class InvalidNowPaymentsCallbackError extends Error {}
  class PaymentEventConflictError extends Error {}
  return {
    InvalidNowPaymentsCallbackError,
    PaymentEventConflictError,
    hashPaymentEvent: vi.fn(),
    processVerifiedPaymentEvent: vi.fn(),
    verifyCallback: vi.fn(),
  };
});

vi.mock('@profitopath/payments', () => ({
  InvalidNowPaymentsCallbackError: mocks.InvalidNowPaymentsCallbackError,
  PaymentEventConflictError: mocks.PaymentEventConflictError,
  hashPaymentEvent: mocks.hashPaymentEvent,
  processVerifiedPaymentEvent: mocks.processVerifiedPaymentEvent,
}));
vi.mock('@/server/payments', () => ({
  nowPaymentsProvider: { verifyCallback: mocks.verifyCallback },
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPaymentEvent.mockReturnValue('a'.repeat(64));
  mocks.verifyCallback.mockResolvedValue({
    amountMinor: 500,
    currency: 'USD',
    orderReferenceId: 'payment-1',
    provider: 'NOWPAYMENTS',
    providerEventId: 'nowpayments:123:finished',
    providerInvoiceId: 'invoice-1',
    providerPaymentId: '123',
    status: 'CONFIRMED',
  });
  mocks.processVerifiedPaymentEvent.mockResolvedValue({});
});

describe('NOWPayments IPN route', () => {
  it('uses the exact raw body and signature before processing a verified event', async () => {
    const response = await POST(
      new Request(
        'https://profitopath.example.test/api/payments/nowpayments/ipn',
        {
          body: '{"payment_id":123}',
          headers: { 'x-nowpayments-sig': 'signature' },
          method: 'POST',
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.verifyCallback).toHaveBeenCalledWith({
      body: '{"payment_id":123}',
      headers: { 'x-nowpayments-sig': 'signature' },
    });
    expect(mocks.processVerifiedPaymentEvent).toHaveBeenCalledWith({
      event: expect.objectContaining({ provider: 'NOWPAYMENTS' }),
      payloadHash: 'a'.repeat(64),
    });
  });

  it('rejects invalid signed notifications without processing them', async () => {
    mocks.verifyCallback.mockRejectedValue(
      new mocks.InvalidNowPaymentsCallbackError(),
    );

    const response = await POST(
      new Request(
        'https://profitopath.example.test/api/payments/nowpayments/ipn',
        {
          body: '{}',
          method: 'POST',
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.processVerifiedPaymentEvent).not.toHaveBeenCalled();
  });
});
