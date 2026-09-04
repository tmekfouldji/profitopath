import Decimal from 'decimal.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  setOwnedPositionProtection: vi.fn(),
  submitOwnedMarketOrder: vi.fn(),
  submitOwnedPendingOrder: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/server/auth/session', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/server/terminal', () => ({
  cancelOwnedOrder: vi.fn(),
  setOwnedPositionProtection: mocks.setOwnedPositionProtection,
  submitOwnedMarketOrder: mocks.submitOwnedMarketOrder,
  submitOwnedPendingOrder: mocks.submitOwnedPendingOrder,
}));

import { initialTerminalActionState } from './action-state';
import { submitTerminalOrder, updatePositionProtection } from './actions';

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

function protectionForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    accountId: 'account-1',
    clientRequestId: 'protection-request-1',
    positionId: 'position-1',
    stopLossPrice: '1.09900',
    takeProfitPrice: '1.10200',
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

  it('maps the explicit Buy bid action to a pending buy limit at the selected bid', async () => {
    mocks.submitOwnedPendingOrder.mockResolvedValue({ status: 'ACCEPTED' });

    const result = await submitTerminalOrder(
      initialTerminalActionState,
      orderForm({
        bidPrice: '1.10000',
        orderIntent: 'BUY_BID',
      }),
    );

    expect(result).toEqual({
      message: 'limit order accepted.',
      status: 'SUCCESS',
    });
    expect(mocks.submitOwnedPendingOrder).toHaveBeenCalledWith('user-1', {
      clientOrderId: 'client-order-1',
      price: expect.any(Decimal),
      quantity: expect.any(Decimal),
      side: 'BUY',
      symbol: 'EURUSD',
      tradingAccountId: 'account-1',
      type: 'LIMIT',
    });
    expect(
      mocks.submitOwnedPendingOrder.mock.calls[0]?.[1].price.toString(),
    ).toBe('1.1');
  });

  it('sends a chart protection drop through the owner-checked server command', async () => {
    mocks.setOwnedPositionProtection.mockResolvedValue({
      positionId: 'position-1',
    });

    const result = await updatePositionProtection(
      initialTerminalActionState,
      protectionForm(),
    );

    expect(result).toEqual({
      message: 'Position protection updated.',
      status: 'SUCCESS',
    });
    expect(mocks.setOwnedPositionProtection).toHaveBeenCalledWith('user-1', {
      clientRequestId: 'protection-request-1',
      positionId: 'position-1',
      stopLossPrice: expect.any(Decimal),
      takeProfitPrice: expect.any(Decimal),
      tradingAccountId: 'account-1',
    });
    expect(
      mocks.setOwnedPositionProtection.mock.calls[0]?.[1].stopLossPrice.toString(),
    ).toBe('1.099');
    expect(
      mocks.setOwnedPositionProtection.mock.calls[0]?.[1].takeProfitPrice.toString(),
    ).toBe('1.102');
  });
});
