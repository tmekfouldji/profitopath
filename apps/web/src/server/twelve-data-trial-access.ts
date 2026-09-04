import 'server-only';

import { canAccessAdmin, type AuthorizedUser } from './auth/authorization';

export class TwelveDataTrialStaffAccessError extends Error {
  constructor() {
    super('Twelve Data trial market data is limited to active staff accounts');
    this.name = 'TwelveDataTrialStaffAccessError';
  }
}

export function isTwelveDataTrialMode(): boolean {
  return process.env.MARKET_DATA_SOURCE === 'twelve-data-trial';
}

export function canAccessTwelveDataTrial(user: AuthorizedUser): boolean {
  return !isTwelveDataTrialMode() || canAccessAdmin(user);
}

export function assertTwelveDataTrialAccess(user: AuthorizedUser): void {
  if (!canAccessTwelveDataTrial(user)) {
    throw new TwelveDataTrialStaffAccessError();
  }
}
