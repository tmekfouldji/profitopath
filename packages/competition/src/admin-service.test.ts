import { describe, expect, it } from 'vitest';

import {
  archiveCompetition,
  CompetitionAdminCommandError,
  disqualifyCompetitionEntry,
} from './admin-service';

describe('competition admin command validation', () => {
  it('rejects missing disqualification reasons before storage access', async () => {
    await expect(
      disqualifyCompetitionEntry({
        actorUserId: 'admin-1',
        entryId: 'entry-1',
        reason: ' ',
      }),
    ).rejects.toThrow(CompetitionAdminCommandError);
  });

  it('requires an archive audit reason', async () => {
    await expect(
      archiveCompetition({
        actorUserId: 'admin-1',
        competitionId: 'competition-1',
        reason: 'x',
      }),
    ).rejects.toThrow('at least 3 characters');
  });
});
