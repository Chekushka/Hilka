/**
 * Database row → the task contract the student surfaces consume.
 *
 * Pure and unit-tested: the row is `jsonb`, so the type system stops at the
 * database boundary and a task that cannot actually be rendered — the wrong
 * type, or a Python task with no reference solution to compute the expected
 * result from — must be rejected here rather than surfacing as a broken
 * workspace.
 */
import type { CodeTask, ParsonsTask, Task } from '@/lib/task/types';
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
    hints: row.hints ?? [],
    reference: row.reference,
    difficulty: clampDifficulty(row.difficulty),
    gradeTags: row.gradeTags ?? [],
    version: row.version,
    status: row.status
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

/** Tries every mapper this platform understands; `null` for a type none of them render yet. */
export function toTask(row: TaskRow): Task | null {
  return toCodeTask(row) ?? toParsonsTask(row);
}

function clampDifficulty(value: number): CodeTask['difficulty'] {
  const rounded = Math.min(5, Math.max(1, Math.round(value)));
  return rounded as CodeTask['difficulty'];
}
