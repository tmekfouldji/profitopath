/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/server/public-leaderboards', () => ({
  listPublicLeaderboardCompetitions: mocks.list,
}));

import LeaderboardsPage from './page';

afterEach(cleanup);

describe('leaderboard index browser view', () => {
  it('separates current and archived weekly boards', async () => {
    mocks.list.mockResolvedValue([
      {
        _count: { entries: 12 },
        id: 'active-1',
        name: 'Current Week',
        status: 'ACTIVE',
        tradingEndsAt: new Date('2026-08-28T21:00:00.000Z'),
        tradingStartsAt: new Date('2026-08-24T00:00:00.000Z'),
      },
      {
        _count: { entries: 9 },
        id: 'archive-1',
        name: 'Archived Week',
        status: 'ARCHIVED',
        tradingEndsAt: new Date('2026-08-21T21:00:00.000Z'),
        tradingStartsAt: new Date('2026-08-17T00:00:00.000Z'),
      },
    ]);

    render(await LeaderboardsPage());

    expect(screen.getByText('Current Week')).toBeTruthy();
    expect(screen.getByText('Archived Week')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Archived Week/i }).getAttribute('href'),
    ).toBe('/leaderboards/archive-1');
  });
});
