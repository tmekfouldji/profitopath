'use server';

import {
  archiveCompetition,
  CompetitionAdminCommandError,
  disqualifyCompetitionEntry,
  finalizeLeaderboard,
  InvalidStateTransitionError,
  LeaderboardFinalizationError,
  processCompetitionLifecycle,
  recomputeLeaderboardForAdmin,
} from '@profitopath/competition';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/server/auth/session';

function formString(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function isExpectedAdminError(error: unknown): boolean {
  return (
    error instanceof CompetitionAdminCommandError ||
    error instanceof InvalidStateTransitionError ||
    error instanceof LeaderboardFinalizationError
  );
}

function finish(notice: string): never {
  redirect(`/admin?notice=${encodeURIComponent(notice)}`);
}

export async function runDueLifecycleAction(): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await processCompetitionLifecycle(new Date(), {
      actorUserId: admin.id,
    });
    notice =
      result.activatedCompetitions + result.frozenCompetitions === 0
        ? 'lifecycle-noop'
        : 'lifecycle-processed';
  } catch {
    notice = 'operation-failed';
  }
  finish(notice);
}

export async function recomputeLeaderboardAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    await recomputeLeaderboardForAdmin({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
      requestId: crypto.randomUUID(),
    });
    notice = 'leaderboard-recomputed';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function finalizeLeaderboardAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await finalizeLeaderboard({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
    });
    notice = result.alreadyFinalized
      ? 'leaderboard-unchanged'
      : 'leaderboard-finalized';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function disqualifyEntryAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await disqualifyCompetitionEntry({
      actorUserId: admin.id,
      entryId: formString(formData, 'entryId'),
      reason: formString(formData, 'reason'),
    });
    notice = result.alreadyDisqualified
      ? 'entry-unchanged'
      : 'entry-disqualified';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}

export async function archiveCompetitionAction(
  formData: FormData,
): Promise<never> {
  const admin = await requireAdmin();
  let notice: string;
  try {
    const result = await archiveCompetition({
      actorUserId: admin.id,
      competitionId: formString(formData, 'competitionId'),
      reason: formString(formData, 'reason'),
    });
    notice = result.alreadyArchived
      ? 'competition-unchanged'
      : 'competition-archived';
  } catch (error) {
    notice = isExpectedAdminError(error)
      ? 'invalid-operation'
      : 'operation-failed';
  }
  finish(notice);
}
