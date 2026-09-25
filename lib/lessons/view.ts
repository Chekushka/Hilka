/**
 * Shaping a lesson for the student view. Pure: the database layer hands in
 * the lesson and the published tasks it found, and this decides what is
 * shown and in which order.
 */
import type { LessonTaskRole } from './types';

export interface LessonTaskSummary {
  id: string;
  slug: string;
  title: string;
  type: string;
  difficulty: number;
  /**
   * Parameterized tasks need a student identity to pick a variant, which
   * practice mode does not have (docs/TASK_SCHEMA.md, "Parameterization") —
   * listed, but only openable in a session.
   */
  sessionOnly: boolean;
}

/** `ids` in order, keeping only the ones that resolve — unpublished tasks are invisible to students. */
export function resolveLessonTasks<T>(ids: readonly string[], byId: ReadonlyMap<string, T>): T[] {
  const out: T[] = [];
  for (const id of ids) {
    const task = byId.get(id);
    if (task) out.push(task);
  }
  return out;
}

export interface LessonTaskStep {
  slug: string;
  role: LessonTaskRole;
}

/**
 * The practice route's walk through a lesson: core tasks, then additional
 * ones, skipping those practice cannot open. `next` is null after the last.
 */
export function lessonSteps(
  core: readonly LessonTaskSummary[],
  additional: readonly LessonTaskSummary[]
): LessonTaskStep[] {
  return [
    ...core.filter((task) => !task.sessionOnly).map((task) => ({ slug: task.slug, role: 'core' as const })),
    ...additional.filter((task) => !task.sessionOnly).map((task) => ({ slug: task.slug, role: 'additional' as const }))
  ];
}

export function stepAfter(steps: readonly LessonTaskStep[], slug: string): LessonTaskStep | null {
  const index = steps.findIndex((step) => step.slug === slug);
  return index >= 0 && index + 1 < steps.length ? steps[index + 1] : null;
}
