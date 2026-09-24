/**
 * The subset of the task contract the platform implements today. The full
 * shape is in docs/TASK_SCHEMA.md; this grows toward it as the types are
 * built, rather than being declared in full and left half-implemented.
 */
import type { Check, ReferenceArtifacts } from '@/lib/checker';
import type { ParamSpec } from '@/lib/seed';

export type TaskType = 'quiz' | 'predict' | 'parsons' | 'fill' | 'code' | 'fix';
export type TaskStatus = 'draft' | 'published' | 'archived';
export type Surface = 'console' | 'turtle' | 'grid';

/**
 * `delivery: 'file'` on `code`/`fix` (docs/TASK_SCHEMA.md, "File Delivery"):
 * the student downloads a generated `.py`, edits it in IDLE and uploads it
 * back. Grading is unchanged — `lib/checker/` never sees this field.
 */
export type Delivery = 'inline' | 'file';

export interface FileSpec {
  /** Expected name, e.g. "bmi.py". A different name is a warning, never a rejection. */
  filename: string;
  /** Inject the taskId/version/seed header into the generated starter file. */
  headerComment: boolean;
  /** Upload size cap after BOM/CRLF normalization. TASK_SCHEMA.md's default is 65536. */
  maxBytes: number;
}

export interface CodePayload {
  type: 'code';
  surface: Surface;
  prompt: string;
  starter: string;
  /** Absent means `'inline'`. */
  delivery?: Delivery;
  /** Required when `delivery` is `'file'`. */
  file?: FileSpec;
}

export interface ParsonsLine {
  text: string;
  indent: number;
}

/**
 * `indentMode: 'given'` shows each line's indent for context; the student
 * only orders the lines. `'chosen'` hides it — the student sets each line's
 * indent too (`components/task-types/ParsonsTaskView.tsx`), graded by
 * `order_equals`'s `checkIndent`/`indents` against `lines[i].indent`, the
 * same value that already IS the correct answer either way
 * (`lib/task/parsons.ts`'s `parsonsCanonicalSubmission`).
 */
export interface ParsonsPayload {
  type: 'parsons';
  prompt: string;
  lines: ParsonsLine[];
  distractors?: string[];
  indentMode: 'given' | 'chosen';
}

/** `multiple: false` means exactly one option is correct; `true` allows several. */
export interface QuizPayload {
  type: 'quiz';
  prompt: string;
  options: string[];
  multiple: boolean;
}

/**
 * `answerMode: 'choice'` picks one of `options` — the candidate predicted
 * outputs — graded with `choice_equals`, same as `quiz`'s single-answer
 * mode; exactly one option must be correct (lib/task/predict.ts). `text`
 * stays free-typed, graded with `text_equals`. `imageOptions` (N turtle
 * reference programs rendered as pictures) is documented in TASK_SCHEMA.md
 * but not built yet — its data shape (where the N programs themselves would
 * live) is not decided, so there is nothing here to author or render for it
 * (docs/TASKS.md Open Questions has the parsons `'chosen'` precedent for
 * this kind of partial build).
 */
export interface PredictPayload {
  type: 'predict';
  prompt: string;
  code: string;
  answerMode: 'text' | 'choice';
  /** `answerMode: 'choice'` only. */
  options?: string[];
}

/**
 * `broken` is what the student sees and edits — the same field
 * `reference.code` plays for `code`, except here it is wrong on purpose.
 * Publish requires both that `reference.code` passes every check AND that
 * `broken` fails at least one (TASK_SCHEMA.md, "Reference solutions") —
 * a "broken" program that already passes is a bug in the task, not a task.
 */
export interface FixPayload {
  type: 'fix';
  surface: Surface;
  prompt: string;
  broken: string;
  /** Absent means `'inline'`. */
  delivery?: Delivery;
  /** Required when `delivery` is `'file'`. */
  file?: FileSpec;
}

/**
 * `template` is Python with numbered gaps written `{{1}}`, `{{2}}`, … —
 * `lib/task/fill.ts` parses and substitutes them. The student fills in each
 * gap rather than typing free-form code; the assembled program then runs and
 * is checked exactly like `code` (`Submission.code` is the substituted
 * result, which is also what `uses`/`forbids` read).
 */
export interface FillPayload {
  type: 'fill';
  prompt: string;
  template: string;
}

/** Widens to the union in TASK_SCHEMA.md as each task type is built. */
export type TaskPayload = CodePayload | ParsonsPayload | QuizPayload | PredictPayload | FixPayload | FillPayload;

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
  /** Input-driven only. Absent means a single run with no stdin (docs/TASK_SCHEMA.md, "Run cases"). */
  cases?: RunCase[];
  hints: string[];
  reference: Reference;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
  /**
   * Session-only (docs/TASK_SCHEMA.md, "Parameterization"): `{name}`
   * placeholders in `payload.prompt`/`starter`, `cases[].stdin` and
   * `reference.code` are substituted server-side, per student, before this
   * ever reaches a browser — `GET /api/sessions/[code]/tasks/[taskId]`
   * strips this field from what it actually sends. Meaningless in
   * `/practice`, which has no student identity to derive a seed from; a
   * parameterized task must only be assigned to a session.
   */
  params?: ParamSpec;
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

/**
 * No `reference` either — like `parsons`, nothing executes. The correct
 * answer lives entirely in `checks` (`choice_equals.indices`); there is no
 * separate "reference" to derive it from, so the publish gate
 * (lib/task/quiz.ts) instead confirms the checks are internally consistent
 * with the payload — indices that actually exist, and exactly one of them
 * when `multiple` is false.
 */
export interface QuizTask {
  id: string;
  slug: string;
  topicId: string;
  type: 'quiz';
  title: string;
  payload: QuizPayload;
  checks: Check[];
  hints: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/**
 * Executes exactly like `code` — `payload.code` IS the reference solution,
 * there is no separate one to author, since the whole point is "what does
 * this fixed program print". `reference.code` is always `payload.code`; the
 * publish gate runs it once to confirm the checks the author wrote (e.g.
 * `text_equals`) actually match its real output, rather than trusting a
 * hand-typed expected value (CLAUDE.md rule 5, lib/checker/reference-check.ts's
 * `evaluatePredictionAgainstOwnRun`).
 */
export interface PredictTask {
  id: string;
  slug: string;
  topicId: string;
  type: 'predict';
  title: string;
  payload: PredictPayload;
  checks: Check[];
  hints: string[];
  reference: Reference;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/**
 * Executes exactly like `code` — the student edits `payload.broken`
 * (pre-filled as the starting code) and Check runs it the same way
 * `useTaskRunner` already does for `code` (lib/task/use-task-runner.ts's
 * `RunnableTask` covers both). `reference.code` is the author's separately
 * written correct fix, never `payload.broken` itself.
 */
export interface FixTask {
  id: string;
  slug: string;
  topicId: string;
  type: 'fix';
  title: string;
  payload: FixPayload;
  checks: Check[];
  /** Input-driven only. Absent means a single run with no stdin (docs/TASK_SCHEMA.md, "Run cases"). */
  cases?: RunCase[];
  hints: string[];
  reference: Reference;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/**
 * Executes exactly like `code` too — the student's gap answers are
 * substituted into `payload.template` (`lib/task/fill.ts`) to build the same
 * `code` string `useTaskRunner`'s `RunnableTask` shape already knows how to
 * run and check. `reference.code` is a separately written, fully correct
 * program — it need not even share `template`'s exact structure, the same
 * way `code`'s `starter` and `reference.code` are independent.
 */
export interface FillTask {
  id: string;
  slug: string;
  topicId: string;
  type: 'fill';
  title: string;
  payload: FillPayload;
  checks: Check[];
  hints: string[];
  reference: Reference;
  difficulty: 1 | 2 | 3 | 4 | 5;
  gradeTags: number[];
  version: number;
  status: TaskStatus;
}

/** Every task type the student-facing surfaces know how to render today. */
export type Task = CodeTask | ParsonsTask | QuizTask | PredictTask | FixTask | FillTask;

/** What a task-type component reports once a Check completes. */
export interface AttemptOutcome {
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
  /** Shape matches `Submission` — `{ code }` for `code`, `fix` and `fill`, `{ orderedLines }` for `parsons`, `{ choiceIndices }` for `quiz`, `{ text }` for `predict`. */
  submittedAnswer: Record<string, unknown>;
}
