'use server';

import {
  cancelCompetitionDraft,
  CompetitionAdminCommandError,
  createChallengeTier,
  createCompetitionDraft,
  publishCompetitionDraft,
  setChallengeTierAvailability,
  setManagedUserRole,
  transitionManagedUserStatus,
  updateCompetitionDraft,
  updateUnusedChallengeTier,
} from '@profitopath/competition';
import { redirect } from 'next/navigation';

import { requireSuperadmin } from '@/server/auth/session';

const maximumEntryFeeMinor = 2_147_483_647n;

function formString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function parseUsdMinor(value: string, label: string): bigint {
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) {
    throw new CompetitionAdminCommandError(
      `${label} must be a USD amount with at most two decimal places`,
    );
  }
  const [whole = '0', fractional = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(`${fractional}00`.slice(0, 2));
}

function parseEntryFee(value: string): number {
  const minor = parseUsdMinor(value, 'Entry fee');
  if (minor < 1n || minor > maximumEntryFeeMinor) {
    throw new CompetitionAdminCommandError(
      'Entry fee is outside the supported range',
    );
  }
  return Number(minor);
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CompetitionAdminCommandError(
      `${label} must be a positive integer`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new CompetitionAdminCommandError(
      `${label} must be a positive integer`,
    );
  }
  return parsed;
}

function parseUtcDateTime(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new CompetitionAdminCommandError(
      `${label} must be a UTC date and time`,
    );
  }
  const parsed = new Date(`${value}:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new CompetitionAdminCommandError(
      `${label} must be a valid UTC date and time`,
    );
  }
  return parsed;
}

function expected(error: unknown): boolean {
  return error instanceof CompetitionAdminCommandError;
}

function finish(path: string, notice: string): never {
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}

function tierValues(formData: FormData) {
  return {
    entryFeeMinor: parseEntryFee(formString(formData, 'entryFeeUsd')),
    maxDrawdownMinor: parseUsdMinor(
      formString(formData, 'maxDrawdownUsd'),
      'Maximum drawdown',
    ),
    name: formString(formData, 'name'),
    performanceBenchmarkMinor: parseUsdMinor(
      formString(formData, 'performanceBenchmarkUsd'),
      'Performance benchmark',
    ),
    rulesVersion: parsePositiveInteger(
      formString(formData, 'rulesVersion'),
      'Rules version',
    ),
    startingBalanceMinor: parseUsdMinor(
      formString(formData, 'startingBalanceUsd'),
      'Starting balance',
    ),
  };
}

function competitionValues(formData: FormData) {
  return {
    name: formString(formData, 'name'),
    rulesVersion: parsePositiveInteger(
      formString(formData, 'rulesVersion'),
      'Rules version',
    ),
    signupClosesAt: parseUtcDateTime(
      formString(formData, 'signupClosesAt'),
      'Signup close',
    ),
    tradingEndsAt: parseUtcDateTime(
      formString(formData, 'tradingEndsAt'),
      'Trading end',
    ),
    tradingStartsAt: parseUtcDateTime(
      formString(formData, 'tradingStartsAt'),
      'Trading start',
    ),
  };
}

export async function createChallengeTierAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await createChallengeTier({
      actorUserId: owner.id,
      code: formString(formData, 'code'),
      ...tierValues(formData),
    });
    finish('/superadmin/challenge-pricing', 'tier-created');
  } catch (error) {
    finish(
      '/superadmin/challenge-pricing',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function updateChallengeTierAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await updateUnusedChallengeTier({
      actorUserId: owner.id,
      tierId: formString(formData, 'tierId'),
      ...tierValues(formData),
    });
    finish('/superadmin/challenge-pricing', 'tier-updated');
  } catch (error) {
    finish(
      '/superadmin/challenge-pricing',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function setChallengeTierAvailabilityAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    const active = formString(formData, 'active') === 'true';
    await setChallengeTierAvailability({
      active,
      actorUserId: owner.id,
      reason: formString(formData, 'reason'),
      tierId: formString(formData, 'tierId'),
    });
    finish(
      '/superadmin/challenge-pricing',
      active ? 'tier-enabled' : 'tier-disabled',
    );
  } catch (error) {
    finish(
      '/superadmin/challenge-pricing',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function createCompetitionDraftAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await createCompetitionDraft({
      actorUserId: owner.id,
      code: formString(formData, 'code'),
      ...competitionValues(formData),
    });
    finish('/superadmin/competitions', 'competition-created');
  } catch (error) {
    finish(
      '/superadmin/competitions',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function updateCompetitionDraftAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await updateCompetitionDraft({
      actorUserId: owner.id,
      competitionId: formString(formData, 'competitionId'),
      ...competitionValues(formData),
    });
    finish('/superadmin/competitions', 'competition-updated');
  } catch (error) {
    finish(
      '/superadmin/competitions',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function publishCompetitionDraftAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await publishCompetitionDraft({
      actorUserId: owner.id,
      competitionId: formString(formData, 'competitionId'),
    });
    finish('/superadmin/competitions', 'competition-published');
  } catch (error) {
    finish(
      '/superadmin/competitions',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function cancelCompetitionDraftAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    await cancelCompetitionDraft({
      actorUserId: owner.id,
      competitionId: formString(formData, 'competitionId'),
      reason: formString(formData, 'reason'),
    });
    finish('/superadmin/competitions', 'competition-cancelled');
  } catch (error) {
    finish(
      '/superadmin/competitions',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function setManagedUserRoleAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    const role = formString(formData, 'role');
    if (role !== 'ADMIN' && role !== 'TRADER') {
      throw new CompetitionAdminCommandError('The platform role is invalid');
    }
    await setManagedUserRole({
      actorUserId: owner.id,
      role,
      userId: formString(formData, 'userId'),
    });
    finish('/superadmin/users', 'role-updated');
  } catch (error) {
    finish(
      '/superadmin/users',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}

export async function transitionManagedUserStatusAction(
  formData: FormData,
): Promise<never> {
  const owner = await requireSuperadmin();
  try {
    const status = formString(formData, 'status');
    if (!['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) {
      throw new CompetitionAdminCommandError('The account status is invalid');
    }
    await transitionManagedUserStatus({
      actorUserId: owner.id,
      reason: formString(formData, 'reason'),
      status: status as 'ACTIVE' | 'CLOSED' | 'SUSPENDED',
      userId: formString(formData, 'userId'),
    });
    finish('/superadmin/users', 'status-updated');
  } catch (error) {
    finish(
      '/superadmin/users',
      expected(error) ? 'invalid-operation' : 'operation-failed',
    );
  }
}
