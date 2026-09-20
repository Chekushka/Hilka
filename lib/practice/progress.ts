/**
 * Practice progress: which tasks a student has already passed, kept in
 * `localStorage` (lib/practice/local-progress.ts) and portable via an 8-char
 * progress code (lib/practice/code.ts, docs/AI_CONTEXT.md's "Progress
 * Codes"). Only `completedTaskSlugs` today — `xp` and `current topic` are
 * part of the unbuilt Meta Layer (docs/TASKS.md) and are not invented here;
 * `progress_codes.state` is a free-form jsonb column, so adding them later
 * needs no migration.
 *
 * Task slugs, not ids: the stable content key across databases
 * (docs/AI_CONTEXT.md's Gotcha on `tasks.slug`), and the only thing a
 * progress code should ever need to survive a re-seed.
 */
export interface PracticeProgress {
  completedTaskSlugs: string[];
}

export const EMPTY_PROGRESS: PracticeProgress = { completedTaskSlugs: [] };

const MAX_COMPLETED_TASKS = 500;
const MAX_SLUG_LENGTH = 200;

export function markTaskCompleted(progress: PracticeProgress, slug: string): PracticeProgress {
  if (progress.completedTaskSlugs.includes(slug)) return progress;
  return { completedTaskSlugs: [...progress.completedTaskSlugs, slug] };
}

/**
 * Union of both sides, never a replace — a student who practised on two
 * machines must not lose one by restoring a code in the wrong order
 * (docs/AI_CONTEXT.md's "Progress Codes").
 */
export function mergeProgress(a: PracticeProgress, b: PracticeProgress): PracticeProgress {
  return { completedTaskSlugs: [...new Set([...a.completedTaskSlugs, ...b.completedTaskSlugs])] };
}

export function hasCompletedTask(progress: PracticeProgress, slug: string): boolean {
  return progress.completedTaskSlugs.includes(slug);
}

/** Guards the request body of `POST /api/progress` against a malformed or abusive payload. */
export function isValidPracticeProgress(value: unknown): value is PracticeProgress {
  if (typeof value !== 'object' || value === null) return false;
  const slugs = (value as Record<string, unknown>).completedTaskSlugs;
  if (!Array.isArray(slugs) || slugs.length > MAX_COMPLETED_TASKS) return false;
  return slugs.every((slug) => typeof slug === 'string' && slug.length > 0 && slug.length <= MAX_SLUG_LENGTH);
}
