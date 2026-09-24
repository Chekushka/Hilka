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

/** A Python value simple enough to compare or send across postMessage. */
export type PyValue = null | boolean | number | string | PyValue[] | { [key: string]: PyValue };

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
  /**
   * Module-level variables left after the run — powers `var_equals`. Only
   * populated when the run finished without an error or timeout; functions,
   * classes, and imported modules are never included.
   */
  vars: Record<string, PyValue>;
  /**
   * `check.python` → whether it evaluated truthy, for every string
   * `RunOptions.exprs` listed — powers the `expr` check kind. A key is
   * missing when the program never reached it (an earlier error or timeout),
   * which the checker already treats as a fail.
   */
  exprResults: Record<string, boolean>;
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
  /** `expr` check bodies to evaluate against the final global scope after the run. */
  exprs?: string[];
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
  /**
   * Parses without running anything — file delivery's upload linter reads
   * the tree before a single line executes (docs/TASK_SCHEMA.md, step 9).
   * Safe to call while a run is in flight.
   */
  parse(code: string): Promise<ParseResult>;
  /** Kills a run in progress. The next run starts a fresh interpreter. */
  cancel(): void;
  /** Releases the worker. */
  dispose(): void;
}

/**
 * A parsed program, engine-neutral: node and field names follow CPython's
 * own `ast` module (3.9+ — `Constant`, no `Index`), so a server-side CPython
 * `ast` dump can produce the same shape and anything that reads it
 * (lib/task/file-lint.ts) runs unchanged on either engine. Operators and
 * contexts (`Add`, `Load`, …) are nodes with no fields, as in CPython.
 */
export interface PyAstNode {
  type: string;
  /** 1-based source line; null for operator/context nodes, which have none. */
  line: number | null;
  fields: { [field: string]: PyAstValue };
}

export type PyAstValue = null | boolean | number | string | PyAstNode | PyAstValue[];

/** A SyntaxError is not a failure of `parse` — it is its answer. */
export type ParseResult = { ok: true; ast: PyAstNode } | { ok: false; error: PyError };
