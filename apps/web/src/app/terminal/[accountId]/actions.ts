'use server';

import { CachedQuoteUnavailableError } from '@profitopath/market-data';
import { SimulatorCommandError } from '@profitopath/simulator';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';

import type { TerminalActionState } from './action-state';
import { requireUser } from '@/server/auth/session';
import {
  cancelOwnedOrder,
  setOwnedPositionProtection,
  submitOwnedMarketOrder,
  submitOwnedPendingOrder,
} from '@/server/terminal';
import {
  assertTwelveDataTrialAccess,
  TwelveDataTrialStaffAccessError,
} from '@/server/twelve-data-trial-access';

function formString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function formDecimal(formData: FormData, name: string): Decimal {
  const value = formString(formData, name);
  if (value === '') {
    throw new SimulatorCommandError(`${name} is required`);
  }
  try {
    return new Decimal(value);
  } catch {
    throw new SimulatorCommandError(`${name} is invalid`);
  }
}

function optionalFormDecimal(formData: FormData, name: string): Decimal | null {
  const value = formString(formData, name);
  if (value === '') {
    return null;
  }
  try {
    return new Decimal(value);
  } catch {
    throw new SimulatorCommandError(`${name} is invalid`);
  }
}

function publicFailure(error: unknown): TerminalActionState {
  if (
    error instanceof SimulatorCommandError ||
    error instanceof CachedQuoteUnavailableError ||
    error instanceof TwelveDataTrialStaffAccessError
  ) {
    return { message: error.message, status: 'ERROR' };
  }
  return {
    message: 'The server could not complete this simulated order.',
    status: 'ERROR',
  };
}

export async function submitTerminalOrder(
  _previous: TerminalActionState,
  formData: FormData,
): Promise<TerminalActionState> {
  const accountId = formString(formData, 'accountId');
  const callbackUrl = `/terminal/${encodeURIComponent(accountId)}`;
  const user = await requireUser(callbackUrl);
  try {
    assertTwelveDataTrialAccess(user);
    const clientOrderId =
      formString(formData, 'clientOrderId') || crypto.randomUUID();
    const quantity = formDecimal(formData, 'quantity');
    const side = formString(formData, 'side');
    const symbol = formString(formData, 'symbol');
    const type = formString(formData, 'type');
    if (side !== 'BUY' && side !== 'SELL') {
      throw new SimulatorCommandError('Order side is invalid');
    }
    if (type === 'MARKET') {
      const result = await submitOwnedMarketOrder(user.id, {
        clientOrderId,
        quantity,
        side,
        symbol,
        tradingAccountId: accountId,
      });
      revalidatePath(callbackUrl);
      return result.status === 'REJECTED'
        ? {
            message: result.rejectionReason ?? 'Order was rejected',
            status: 'ERROR',
          }
        : { message: 'Market order filled.', status: 'SUCCESS' };
    }
    if (type !== 'LIMIT' && type !== 'STOP') {
      throw new SimulatorCommandError('Order type is invalid');
    }
    const result = await submitOwnedPendingOrder(user.id, {
      clientOrderId,
      price: formDecimal(formData, 'price'),
      quantity,
      side,
      symbol,
      tradingAccountId: accountId,
      type,
    });
    revalidatePath(callbackUrl);
    if (result.status === 'REJECTED') {
      return {
        message: result.rejectionReason ?? 'Order was rejected',
        status: 'ERROR',
      };
    }
    return {
      message:
        result.status === 'FILLED'
          ? `${type.toLowerCase()} order filled.`
          : `${type.toLowerCase()} order accepted.`,
      status: 'SUCCESS',
    };
  } catch (error) {
    return publicFailure(error);
  }
}

export async function cancelTerminalOrder(formData: FormData): Promise<void> {
  const accountId = formString(formData, 'accountId');
  const callbackUrl = `/terminal/${encodeURIComponent(accountId)}`;
  const user = await requireUser(callbackUrl);
  assertTwelveDataTrialAccess(user);
  await cancelOwnedOrder(user.id, {
    orderId: formString(formData, 'orderId'),
    tradingAccountId: accountId,
  });
  revalidatePath(callbackUrl);
}

export async function updatePositionProtection(
  _previous: TerminalActionState,
  formData: FormData,
): Promise<TerminalActionState> {
  const accountId = formString(formData, 'accountId');
  const callbackUrl = `/terminal/${encodeURIComponent(accountId)}`;
  const user = await requireUser(callbackUrl);
  try {
    assertTwelveDataTrialAccess(user);
    await setOwnedPositionProtection(user.id, {
      clientRequestId:
        formString(formData, 'clientRequestId') || crypto.randomUUID(),
      positionId: formString(formData, 'positionId'),
      stopLossPrice: optionalFormDecimal(formData, 'stopLossPrice'),
      takeProfitPrice: optionalFormDecimal(formData, 'takeProfitPrice'),
      tradingAccountId: accountId,
    });
    revalidatePath(callbackUrl);
    return { message: 'Position protection updated.', status: 'SUCCESS' };
  } catch (error) {
    return publicFailure(error);
  }
}
