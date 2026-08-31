import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelCompetitionDraft: vi.fn(),
  createChallengeTier: vi.fn(),
  createCompetitionDraft: vi.fn(),
  publishCompetitionDraft: vi.fn(),
  redirect: vi.fn(),
  requireSuperadmin: vi.fn(),
  setChallengeTierAvailability: vi.fn(),
  setManagedUserRole: vi.fn(),
  transitionManagedUserStatus: vi.fn(),
  updateCompetitionDraft: vi.fn(),
  updateUnusedChallengeTier: vi.fn(),
}));

vi.mock('@profitopath/competition', () => ({
  cancelCompetitionDraft: mocks.cancelCompetitionDraft,
  CompetitionAdminCommandError: class CompetitionAdminCommandError extends Error {},
  createChallengeTier: mocks.createChallengeTier,
  createCompetitionDraft: mocks.createCompetitionDraft,
  publishCompetitionDraft: mocks.publishCompetitionDraft,
  setChallengeTierAvailability: mocks.setChallengeTierAvailability,
  setManagedUserRole: mocks.setManagedUserRole,
  transitionManagedUserStatus: mocks.transitionManagedUserStatus,
  updateCompetitionDraft: mocks.updateCompetitionDraft,
  updateUnusedChallengeTier: mocks.updateUnusedChallengeTier,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/server/auth/session', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
}));

import { CompetitionAdminCommandError } from '@profitopath/competition';

import { createCompetitionDraftAction } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({ id: 'owner-1' });
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
});

function validDraftForm(): FormData {
  const form = new FormData();
  form.set('code', 'WEEK-20260915');
  form.set('name', 'September 15 Weekly');
  form.set('rulesVersion', '1');
  form.set('signupClosesAt', '2026-09-14T23:00');
  form.set('tradingStartsAt', '2026-09-15T00:00');
  form.set('tradingEndsAt', '2026-09-19T23:00');
  return form;
}

describe('superadmin server actions', () => {
  it('preserves the successful competition creation redirect', async () => {
    mocks.createCompetitionDraft.mockResolvedValue({ id: 'competition-1' });

    await expect(
      createCompetitionDraftAction(validDraftForm()),
    ).rejects.toThrow(
      'redirect:/superadmin/competitions?notice=competition-created',
    );

    expect(mocks.createCompetitionDraft).toHaveBeenCalledWith({
      actorUserId: 'owner-1',
      code: 'WEEK-20260915',
      name: 'September 15 Weekly',
      rulesVersion: 1,
      signupClosesAt: new Date('2026-09-14T23:00:00.000Z'),
      tradingEndsAt: new Date('2026-09-19T23:00:00.000Z'),
      tradingStartsAt: new Date('2026-09-15T00:00:00.000Z'),
    });
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });

  it('keeps rejected domain commands on the safe invalid-operation path', async () => {
    mocks.createCompetitionDraft.mockRejectedValue(
      new CompetitionAdminCommandError('Competition code is already in use'),
    );

    await expect(
      createCompetitionDraftAction(validDraftForm()),
    ).rejects.toThrow(
      'redirect:/superadmin/competitions?notice=invalid-operation&detail=Competition+code+is+already+in+use',
    );
  });
});
