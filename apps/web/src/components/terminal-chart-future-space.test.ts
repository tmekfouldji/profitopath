import { describe, expect, it } from 'vitest';

import {
  futureDrawingLogicalPosition,
  futureDrawingTimeAtLogicalPosition,
} from './terminal-chart-future-space';

describe('terminal chart future drawing space', () => {
  it('maps empty right-side logical space to future candle times', () => {
    expect(
      futureDrawingTimeAtLogicalPosition({
        lastLogical: 499,
        lastTime: 1_724_000_000,
        logical: 506.5,
        secondsPerBar: 60,
      }),
    ).toBe(1_724_000_450);
  });

  it('maps saved future drawing times back to the right-side logical space', () => {
    expect(
      futureDrawingLogicalPosition({
        lastLogical: 499,
        lastTime: 1_724_000_000,
        secondsPerBar: 60,
        time: 1_724_000_450,
      }),
    ).toBe(506.5);
  });

  it('does not extrapolate the left side of the loaded chart', () => {
    expect(
      futureDrawingTimeAtLogicalPosition({
        lastLogical: 499,
        lastTime: 1_724_000_000,
        logical: 499.5,
        secondsPerBar: 60,
      }),
    ).toBeNull();
    expect(
      futureDrawingLogicalPosition({
        lastLogical: 499,
        lastTime: 1_724_000_000,
        secondsPerBar: 60,
        time: 1_724_000_000,
      }),
    ).toBeNull();
  });
});
