/**
 * Task tags (docs/TASK_SCHEMA.md, "Tags"): what kind of work a task is, for
 * the teacher choosing tasks for a particular student — independent of
 * difficulty, which weighs a task in a grade. A closed vocabulary, so the
 * catalog's filter chips and the session builder's route picker can rely on
 * it; anything else in stored data is dropped on read, never shown.
 *
 * - `retype`: the student types out code given in the prompt and runs it. Keeps
 *   a student who is not ready for the lesson's task busy with something they
 *   can finish, and still puts real Python under their fingers.
 * - `easy-start`: one idea, one step, a sure first success.
 * - `challenge`: beyond the lesson's core, for a student who finished early.
 *
 * Pure.
 */

export const TASK_TAGS = ['retype', 'easy-start', 'challenge'] as const;

export type TaskTag = (typeof TASK_TAGS)[number];

export function isTaskTag(value: unknown): value is TaskTag {
  return typeof value === 'string' && (TASK_TAGS as readonly string[]).includes(value);
}

/** Known tags only, each once, in vocabulary order — what is stored and shown. */
export function normalizeTags(value: unknown): TaskTag[] {
  if (!Array.isArray(value)) return [];
  const present = new Set(value.filter(isTaskTag));
  return TASK_TAGS.filter((tag) => present.has(tag));
}

/** The tags that mark a task as fitting a student who needs a gentler start. */
export const SUPPORT_TAGS: readonly TaskTag[] = ['retype', 'easy-start'];

/** The tags that mark a task as fitting a student who finished early. */
export const EXTENSION_TAGS: readonly TaskTag[] = ['challenge'];
