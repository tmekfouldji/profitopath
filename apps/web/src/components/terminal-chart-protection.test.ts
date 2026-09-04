import { describe, expect, it } from 'vitest';

import { shouldDisplayTerminalProtectionLine } from './terminal-chart';

describe('terminal protection controls', () => {
  it('keeps unset TP and SL as entry-line controls rather than preset price lines', () => {
    expect(shouldDisplayTerminalProtectionLine(null, false)).toBe(false);
  });

  it('shows a line only for an existing value or while the trader drags a new value', () => {
    expect(shouldDisplayTerminalProtectionLine('1.10120', false)).toBe(true);
    expect(shouldDisplayTerminalProtectionLine(null, true)).toBe(true);
  });
});
