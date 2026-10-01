/**
 * Which line of the student's program a suspension came from.
 *
 * Skulpt compiles `$currLineNo` as a local of each compiled function, so a
 * builtin like `input()` cannot read it while it runs (see Segment.line in
 * types.ts). A call that *suspends* is different: every compiled frame it
 * unwinds through saves its own suspension, and each records `$filename` and
 * `$lineno`. The chain runs outermost → innermost through `child`, so the last
 * frame from the student's file is the line that made the call — inside a
 * function, the line in the function body, not the call site of the function.
 */
export interface SuspensionFrame {
  child?: unknown;
  $filename?: string;
  $lineno?: number;
}

/** Skulpt's filename for the program run through `importMainWithBody('<stdin>', …)`. */
export const PROGRAM_FILENAME = '<stdin>.py';

export function suspensionLine(suspension: SuspensionFrame, filename = PROGRAM_FILENAME): number | null {
  let line: number | null = null;
  let frame: SuspensionFrame | undefined = suspension;
  // Bounded: a malformed chain must not hang the worker.
  for (let depth = 0; frame && depth < 1000; depth += 1) {
    if (frame.$filename === filename && typeof frame.$lineno === 'number') {
      line = frame.$lineno;
    }
    const next: unknown = frame.child;
    frame = typeof next === 'object' && next !== null ? (next as SuspensionFrame) : undefined;
  }
  return line;
}
