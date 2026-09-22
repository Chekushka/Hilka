/**
 * The checker contract. Checks are data, never code — no JavaScript in the
 * database, no eval, no new Function — so this evaluator can run unchanged on
 * the server when graded submissions need verifying. Nothing here may reach for
 * the DOM, the runner, or anything else that only exists in a browser.
 *
 * The kinds mirror docs/TASK_SCHEMA.md exactly.
 */
import type { Segment } from '@/lib/runner';

export type Check = { message?: string } & (
  // --- no execution ---------------------------------------------------------
  | { kind: 'choice_equals'; indices: number[] }
  | { kind: 'order_equals'; lines: number[]; checkIndent?: boolean; indents?: number[] }
  | { kind: 'text_equals'; value: string; normalize?: 'trim' | 'loose' }

  // --- console output -------------------------------------------------------
  | { kind: 'stdout_equals'; value: string; trim?: boolean }
  | { kind: 'stdout_contains'; value: string; ignoreCase?: boolean }
  | { kind: 'last_line_equals'; value: string; normalize?: 'trim' | 'loose' }
  | { kind: 'number_close'; value: number; tol: number; which?: 'last' | 'first' | number }
  | { kind: 'numbers_equal'; values: number[]; tol: number }

  // --- program state --------------------------------------------------------
  | { kind: 'var_equals'; name: string; value: unknown }
  | { kind: 'expr'; python: string }

  // --- turtle ---------------------------------------------------------------
  | { kind: 'shape_equals'; tolerance?: number; normalize?: ShapeNormalization[] }
  | { kind: 'shape_contains'; segments: Segment[]; tolerance?: number }
  | {
      kind: 'shape_props';
      closed?: boolean;
      segmentCount?: number | [number, number];
      totalLength?: [number, number];
      bbox?: [number, number, number, number];
      colors?: string[];
    }

  // --- source constraints ---------------------------------------------------
  | { kind: 'uses'; any?: string[]; all?: string[] }
  | { kind: 'forbids'; names: string[] }

  // --- grid (optional, build later) ----------------------------------------
  | { kind: 'grid_goal' }
);

export type ShapeNormalization = 'translate' | 'rotate' | 'scale';

/** What the student produced, before anything is executed. */
export interface Submission {
  /** quiz: selected option indices. */
  choiceIndices?: number[];
  /** parsons: the chosen lines in order, with the indentation they set. */
  orderedLines?: { index: number; indent: number }[];
  /** predict, and any free-text answer. */
  text?: string;
  /** code, fix, fill after substitution — kept for uses/forbids. */
  code?: string;
}

/** The author's correct solution, executed. Never hand-written. */
export interface ReferenceArtifacts {
  stdout?: string;
  drawing?: Segment[];
}

/** Everything a check may look at. Anything absent simply fails its checks. */
export interface Evidence {
  submission: Submission;
  run?: {
    stdout: string;
    drawing: Segment[];
    error: { type: string; message: string } | null;
    timedOut: boolean;
    /** Module-level variables left after the run. Powers `var_equals`. */
    vars?: Record<string, unknown>;
    /** `check.python` → whether it evaluated truthy. Powers `expr`. */
    exprResults?: Record<string, boolean>;
  } | null;
  reference?: ReferenceArtifacts | null;
}

export interface CheckResult {
  check: Check;
  passed: boolean;
  /** The author's message when they wrote one, else a calm generic line. */
  message: string;
  /** True when the kind has no evaluator yet, so a pass cannot be claimed. */
  unsupported?: boolean;
}

export interface CheckReport {
  passed: boolean;
  results: CheckResult[];
}
