import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  submitOwnedMarketOrder: vi.fn(),
  submitOwnedPendingOrder: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/server/terminal', () => ({
  cancelOwnedOrder: vi.fn(),
  setOwnedPositionProtection: vi.fn(),
  submitOwnedMarketOrder: mocks.submitOwnedMarketOrder,
  submitOwnedPendingOrder: mocks.submitOwnedPendingOrder,
}));

import { initialTerminalActionState, submitTerminalOrder } from './actions';

function orderForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    accountId: 'account-1',
    clientOrderId: 'client-order-1',
    price: '',
    quantity: '0.10',
    side: 'BUY',
    symbol: 'EURUSD',
    type: 'MARKET',
    ...overrides,
  })) {
    form.set(key, value);
  }
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: 'user-1' });
});

describe('terminal server actions', () => {
  it('passes exact Decimal input to the owner-checked market command', async () => {
    mocks.submitOwnedMarketOrder.mockResolvedValue({ status: 'FILLED' });

    const result = await submitTerminalOrder(
      initialTerminalActionState,
      orderForm(),
    );

    expect(result).toEqual({
      message: 'Market order filled.',
      status: 'SUCCESS',
    });
    expect(mocks.submitOwnedMarketOrder).toHaveBeenCalledWith('user-1', {
      clientOrderId: 'client-order-1',
      quantity: expect.any(Decimal),
      side: 'BUY',
      symbol: 'EURUSD',
      tradingAccountId: 'account-1',
    });
    expect(
      mocks.submitOwnedMarketOrder.mock.calls[0]?.[1].quantity.toString(),
    ).toBe('0.1');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/terminal/account-1');
  });

  it('rejects invalid browser enums before calling the simulator', async () => {
    const result = await submitTerminalOrder(
      initialTerminalActionState,
      orderForm({ side: 'HOLD' }),
    );

    expect(result).toEqual({
      message: 'Order side is invalid',
      status: 'ERROR',
    });
    expect(mocks.submitOwnedMarketOrder).not.toHaveBeenCalled();
    expect(mocks.submitOwnedPendingOrder).not.toHaveBeenCalled();
  });
});
