/**
 * The subset of the task contract the platform implements today. The full
 * shape is in docs/TASK_SCHEMA.md; this grows toward it as the types are
 * built, rather than being declared in full and left half-implemented.
 */
import type { Check, ReferenceArtifacts } from '@/lib/checker';

export type TaskType = 'quiz' | 'predict' | 'parsons' | 'fill' | 'code' | 'fix';
export type TaskStatus = 'draft' | 'published' | 'archived';
export type Surface = 'console' | 'turtle' | 'grid';

export interface CodePayload {
  type: 'code';
  surface: Surface;
  prompt: string;
  starter: string;
}

export interface ParsonsLine {
  text: string;
  indent: number;
}

/**
 * `indentMode: 'chosen'` is documented in TASK_SCHEMA.md but not built yet —
 * the checker's `order_equals` has nowhere to read an expected indent from,
 * so nothing here can grade it. Every parsons task is authored and rendered
 * as `'given'` until that lands (docs/TASKS.md Open Questions).
 */
export interface ParsonsPayload {
  type: 'parsons';
  prompt: string;
  lines: ParsonsLine[];
  distractors?: string[];
  indentMode: 'given' | 'chosen';
}

/** Widens to the union in TASK_SCHEMA.md as each task type is built. */
export type TaskPayload = CodePayload | ParsonsPayload;

/**
 * One input set of an input-driven task: the code runs once per case, with
 * stdin queued, and each case carries its own checks (docs/TASK_SCHEMA.md).
 */
export interface RunCase {
  stdin: string[];
  checks?: Check[];
  label?: string;
  hidden?: boolean;
}

/**
 * The author's correct solution. `artifacts` are computed by executing
 * `code` on publish — never typed by hand, never stored as an image.
 */
export interface Reference {
  code: string;
  computedAt?: string;
  artifacts?: ReferenceArtifacts;
}

export interface CodeTask {
  /** Database identity. */
  id: string;
  /** Content identity: stable across databases, used by the JSON in content/. */
  slug: string;
  topicId: string;
  type: 'code';
  title: string;
  payload: CodePayload;
  checks: Check[];
  hints: string[];
  reference: Reference;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/**
 * No `reference` — nothing executes, so there is nothing to run and derive
 * artifacts from. The payload's own line order already is the correct
 * answer (lib/task/parsons.ts), which is what the publish gate checks
 * instead of a reference run.
 */
export interface ParsonsTask {
  id: string;
  slug: string;
  topicId: string;
  type: 'parsons';
  title: string;
  payload: ParsonsPayload;
  checks: Check[];
  hints: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/** Every task type the student-facing surfaces know how to render today. */
export type Task = CodeTask | ParsonsTask;

/** What a task-type component reports once a Check completes. */
export interface AttemptOutcome {
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
  /** Shape matches `Submission` — `{ code }` for `code`, `{ orderedLines }` for `parsons`. */
  submittedAnswer: Record<string, unknown>;
}
