/**
 * Database row → the task contract the student surfaces consume.
 *
 * Pure and unit-tested: the row is `jsonb`, so the type system stops at the
 * database boundary and a task that cannot actually be rendered — the wrong
 * type, or a Python task with no reference solution to compute the expected
 * result from — must be rejected here rather than surfacing as a broken
 * workspace.
 */
import type { CodeTask, FillTask, FixTask, ParsonsTask, PredictTask, QuizTask, Task } from '@/lib/task/types';
import type { tasks } from './schema';

export type TaskRow = typeof tasks.$inferSelect;

export function toCodeTask(row: TaskRow): CodeTask | null {
  if (row.type !== 'code' || row.payload?.type !== 'code') {
    return null;
  }
  // CLAUDE.md rule 5: expected results come from executing the author's
  // reference solution. Without one there is nothing to compare against.
  if (!row.reference?.code) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'code',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    cases: row.cases ?? undefined,
    hints: row.hints ?? [],
    reference: row.reference,
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status,
    params: row.params ?? undefined
  };
}

/** No reference to require here — a parsons task has nothing to execute. */
export function toParsonsTask(row: TaskRow): ParsonsTask | null {
  if (row.type !== 'parsons' || row.payload?.type !== 'parsons') {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'parsons',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    hints: row.hints ?? [],
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
  };
}

/** No reference either — a quiz task's correct answer lives entirely in `checks`. */
export function toQuizTask(row: TaskRow): QuizTask | null {
  if (row.type !== 'quiz' || row.payload?.type !== 'quiz') {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'quiz',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    hints: row.hints ?? [],
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
  };
}

/** Executes like `code` — `payload.code` IS the reference, so this requires one, same as `toCodeTask`. */
export function toPredictTask(row: TaskRow): PredictTask | null {
  if (row.type !== 'predict' || row.payload?.type !== 'predict') {
    return null;
  }
  if (!row.reference?.code) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'predict',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    hints: row.hints ?? [],
    reference: row.reference,
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
  };
}

/** Executes like `code` — `payload.broken` is what the student edits, `reference.code` the author's separate fix, so this requires one too. */
export function toFixTask(row: TaskRow): FixTask | null {
  if (row.type !== 'fix' || row.payload?.type !== 'fix') {
    return null;
  }
  if (!row.reference?.code) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'fix',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    cases: row.cases ?? undefined,
    hints: row.hints ?? [],
    reference: row.reference,
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
  };
}

/** Executes like `code` — the student's gap answers substitute into `payload.template`, so this requires a separately authored `reference.code` too. */
export function toFillTask(row: TaskRow): FillTask | null {
  if (row.type !== 'fill' || row.payload?.type !== 'fill') {
    return null;
  }
  if (!row.reference?.code) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    topicId: row.topicId,
    type: 'fill',
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    hints: row.hints ?? [],
    reference: row.reference,
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
  };
}

/** Tries every mapper this platform understands; `null` for a type none of them render yet. */
export function toTask(row: TaskRow): Task | null {
  return (
    toCodeTask(row) ?? toParsonsTask(row) ?? toQuizTask(row) ?? toPredictTask(row) ?? toFixTask(row) ?? toFillTask(row)
  );
}

function clampDifficulty(value: number): CodeTask['difficulty'] {
  const rounded = Math.min(5, Math.max(1, Math.round(value)));
  return rounded as CodeTask['difficulty'];
}
