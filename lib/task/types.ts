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

/** Widens to the union in TASK_SCHEMA.md as each task type is built. */
export type TaskPayload = CodePayload;

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
