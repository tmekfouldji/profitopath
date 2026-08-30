/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSuperadminOverview: vi.fn(),
  requireSuperadmin: vi.fn(),
}));

vi.mock('@/server/auth/session', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
}));
vi.mock('@/server/queries', () => ({
  getSuperadminOverview: mocks.getSuperadminOverview,
}));

import SuperadminPage from './page';

afterEach(cleanup);

describe('superadmin control-plane view', () => {
  it('shows authoritative signals without exposing API-key material', async () => {
    mocks.requireSuperadmin.mockResolvedValue({ id: 'superadmin-1' });
    mocks.getSuperadminOverview.mockResolvedValue({
      activeAccounts: 3,
      configuration: {
        email: 'SMTP verification enabled',
        emailProvider: 'smtp',
        marketData: 'Mock feed held',
        marketDataSource: 'mock',
        nowPayments: 'Credentials ready — mock checkout active',
        paymentProvider: 'mock',
        publicOrigin: 'https://profitopath.com',
      },
      confirmedPayments: 8,
      confirmedRevenueMinor: 24_500,
      connectedMembers: 2,
      members: 14,
      newMembersLast30Days: 5,
      totalAccounts: 7,
      uniqueVisitorsLast30Days: 31,
    });

    render(await SuperadminPage());

    expect(screen.getByText('Control plane')).toBeTruthy();
    expect(screen.getByText('$245.00')).toBeTruthy();
    expect(screen.getByText(/one anonymous browser per utc day/i)).toBeTruthy();
    expect(screen.getByText(/never their contents/i)).toBeTruthy();
    expect(mocks.requireSuperadmin).toHaveBeenCalledOnce();
  });
});
