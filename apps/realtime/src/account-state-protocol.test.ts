import { describe, expect, it } from 'vitest';

import { parseAccountStateDelta } from './protocol';

describe('account-state realtime protocol', () => {
  it('normalizes a post-simulation account-state signal', () => {
    expect(
      parseAccountStateDelta(
        JSON.stringify({
          kind: 'account-state',
          sequence: '19',
          symbol: 'eurusd',
          timestamp: '2026-09-04T12:00:00.000Z',
        }),
      ),
    ).toEqual({
      kind: 'account-state',
      sequence: '19',
      symbol: 'EURUSD',
      timestamp: '2026-09-04T12:00:00.000Z',
    });
  });

  it('rejects malformed account-state signals', () => {
    expect(
      parseAccountStateDelta(
        JSON.stringify({
          kind: 'account-state',
          sequence: '19',
          symbol: 'EURUSD',
          timestamp: 'not-a-date',
        }),
      ),
    ).toBeNull();
  });
});
