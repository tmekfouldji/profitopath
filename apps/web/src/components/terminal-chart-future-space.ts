export function futureDrawingTimeAtLogicalPosition(input: {
  lastLogical: number;
  lastTime: number;
  logical: number | null;
  secondsPerBar: number;
}): number | null {
  if (input.logical === null || input.logical <= input.lastLogical + 0.5) {
    return null;
  }
  return Math.round(
    input.lastTime + (input.logical - input.lastLogical) * input.secondsPerBar,
  );
}

export function futureDrawingLogicalPosition(input: {
  lastLogical: number;
  lastTime: number;
  secondsPerBar: number;
  time: number;
}): number | null {
  if (input.time <= input.lastTime) return null;
  return (
    input.lastLogical + (input.time - input.lastTime) / input.secondsPerBar
  );
}
