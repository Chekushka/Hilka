/**
 * A graded session should draw only from mandatory lessons' core tasks
 * (docs/AI_CONTEXT.md, "Grading": practice and additional tasks never lower
 * anyone's grade). The session builder does not forbid it — the teacher
 * decides — but warns, naming each task that is not graded material.
 */
import type { LessonKind, LessonTaskRole } from './types';

export interface LessonPlacement {
  kind: LessonKind;
  coreTaskIds: readonly string[];
  additionalTaskIds: readonly string[];
}

export type NonGradedReason = 'practice-lesson' | 'additional';

export interface NonGradedTask {
  taskId: string;
  reason: NonGradedReason;
}

function roleIn(lesson: LessonPlacement, taskId: string): LessonTaskRole | null {
  if (lesson.coreTaskIds.includes(taskId)) return 'core';
  if (lesson.additionalTaskIds.includes(taskId)) return 'additional';
  return null;
}

/**
 * Tasks among `taskIds` that are not graded material, in the given order.
 * A task counts as graded material if it is a core task of *any* mandatory
 * lesson — the same task can sit in two lessons, and one mandatory placement
 * is enough. A task in no lesson at all is not warned about: nothing says it
 * is practice material. When a task is non-graded, `additional` wins over
 * `practice-lesson` as the reason, since it is the stronger signal.
 */
export function findNonGradedTasks(taskIds: readonly string[], lessons: readonly LessonPlacement[]): NonGradedTask[] {
  const result: NonGradedTask[] = [];
  for (const taskId of taskIds) {
    let placed = false;
    let mandatoryCore = false;
    let additional = false;
    for (const lesson of lessons) {
      const role = roleIn(lesson, taskId);
      if (!role) continue;
      placed = true;
      if (role === 'additional') additional = true;
      else if (lesson.kind === 'mandatory') mandatoryCore = true;
    }
    if (!placed || mandatoryCore) continue;
    result.push({ taskId, reason: additional ? 'additional' : 'practice-lesson' });
  }
  return result;
}

/**
 * Appends a lesson's tasks (core, then additional) to a selection, skipping
 * ones already chosen and ones the caller cannot assign (unpublished), so
 * adding a lesson twice is a no-op and the click order is kept.
 */
export function addLessonToSelection(
  selected: readonly string[],
  lesson: { coreTaskIds: readonly string[]; additionalTaskIds: readonly string[] },
  assignable: ReadonlySet<string>
): string[] {
  const next = [...selected];
  for (const id of [...lesson.coreTaskIds, ...lesson.additionalTaskIds]) {
    if (assignable.has(id) && !next.includes(id)) next.push(id);
  }
  return next;
}
