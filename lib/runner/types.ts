/**
 * The runner boundary.
 *
 * Nothing outside lib/runner/ may import Skulpt, so that the engine can be
 * swapped — Pyodide for an advanced track, or a server-side runner for trusted
 * grading — without touching the app. Everything the rest of the product knows
 * about Python execution is in this file.
 */

/** One pen-down movement. Turtle output is a set of these, never a command log. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  /**
   * Source line that produced the segment, for playback highlighting.
   * Always null with Skulpt: the compiler emits $currLineNo as a local of the
   * compiled function, so a module stub cannot read it. Playback falls back to
   * call order, which is equivalent for the linear code grade 7 writes.
   * Kept in the shape because a future engine may be able to supply it.
   */
  line: number | null;
}

export interface Dot {
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface PyError {
  /** Skulpt's exception type name: NameError, TypeError, SyntaxError, … */
  type: string;
  /** Skulpt's own wording, which is not CPython's. lib/errors/ matches on this. */
  message: string;
  line: number | null;
  /** 0 for runtime errors, null for SyntaxError. The editor marks lines, not columns. */
  col: number | null;
}

export interface RunResult {
  stdout: string;
  error: PyError | null;
  /** Empty when the program never touched turtle. */
  drawing: Segment[];
  dots: Dot[];
  timedOut: boolean;
  inputsConsumed: number;
  /** Execution time with input waits excluded, matching how the limit is counted. */
  elapsedMs: number;
}

export interface RunOptions {
  /**
   * 'interactive' drives a real input line in the output panel and lets the
   * student answer. 'headless' consumes a pre-queued stdin, one run per test
   * case, and is what Check uses.
   */
  mode: 'interactive' | 'headless';
  /** Headless only: consumed in order by input(). */
  stdin?: string[];
  /** Excludes time spent waiting for input. Default 5000. */
  timeoutMs?: number;
  /** Headless only: makes `random` reproducible so the run can be checked. */
  randomSeed?: number;
  onStdout?: (chunk: string) => void;
  /** Interactive only. Resolve with what the student typed. */
  onInputRequest?: (prompt: string) => Promise<string>;
}

export interface PythonRunner {
  /**
   * Starts the engine and resolves when it can accept a run. Loading Skulpt
   * takes a couple of seconds on a classroom machine, and the workspace has to
   * show that rather than leave a dead button — a blank panel is what makes a
   * student press F5.
   */
  warmUp(): Promise<void>;
  run(code: string, options: RunOptions): Promise<RunResult>;
  /** Kills a run in progress. The next run starts a fresh interpreter. */
  cancel(): void;
  /** Releases the worker. */
  dispose(): void;
}
