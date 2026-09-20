/**
 * Pure step math for the turtle playback scrubber.
 *
 * `Segment.line` is always null (AI_CONTEXT.md Gotchas — Skulpt's compiler
 * keeps `$currLineNo` as a local of the compiled function, so a module stub
 * can never read it). Playback is therefore driven by a segment's position
 * in the drawing array — the order turtle calls actually happened in — not
 * by source line. Equivalent for the linear code grade 7 writes.
 */
export function clampStep(step: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(step, 0), total);
}

export function stepBy(step: number, delta: number, total: number): number {
  return clampStep(step + delta, total);
}

export function isFinished(step: number, total: number): boolean {
  return total > 0 && step >= total;
}
