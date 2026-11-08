/**
 * Practice progress: which tasks a student has already passed, kept in
 * `localStorage` (lib/practice/local-progress.ts) and portable via an 8-char
 * progress code (lib/practice/code.ts, docs/AI_CONTEXT.md's "Progress
 * Codes"). `completedTaskSlugs`, the lessons whose theory was finished, and the look the student picked for their
 * character (lib/meta/character.ts). XP and the level are derived from the
 * slugs by task difficulty (lib/meta/progress.ts) rather than stored beside
 * them, so there is nothing to merge or keep in sync.
 *
 * Task slugs, not ids: the stable content key across databases
 * (docs/AI_CONTEXT.md's Gotcha on `tasks.slug`), and the only thing a
 * progress code should ever need to survive a re-seed.
 */
import { isValidStoredLook, type CharacterLook } from '@/lib/meta/character';

export interface PracticeProgress {
  completedTaskSlugs: string[];
  /**
   * Lessons whose theory deck the student went through to the end, every
   * «Як думаєш?» card answered (lib/lessons/theory.ts). Lesson slugs, like
   * task slugs above. Absent in progress saved before theory cards existed.
   */
  completedTheorySlugs?: string[];
  /** The character's look, slot by slot; absent until the student changes something. */
  look?: Partial<CharacterLook>;
}

export const EMPTY_PROGRESS: PracticeProgress = { completedTaskSlugs: [] };

const MAX_COMPLETED_TASKS = 500;
const MAX_COMPLETED_LESSONS = 300;
const MAX_SLUG_LENGTH = 200;

const isSlug = (slug: unknown): boolean => typeof slug === 'string' && slug.length > 0 && slug.length <= MAX_SLUG_LENGTH;

export function markTaskCompleted(progress: PracticeProgress, slug: string): PracticeProgress {
  if (progress.completedTaskSlugs.includes(slug)) return progress;
  return { ...progress, completedTaskSlugs: [...progress.completedTaskSlugs, slug] };
}

export function markTheoryCompleted(progress: PracticeProgress, lessonSlug: string): PracticeProgress {
  const done = progress.completedTheorySlugs ?? [];
  if (done.includes(lessonSlug)) return progress;
  return { ...progress, completedTheorySlugs: [...done, lessonSlug] };
}

export function hasCompletedTheory(progress: PracticeProgress, lessonSlug: string): boolean {
  return progress.completedTheorySlugs?.includes(lessonSlug) ?? false;
}

export function setLook(progress: PracticeProgress, look: Partial<CharacterLook>): PracticeProgress {
  return { ...progress, look };
}

/**
 * Union of both sides, never a replace — a student who practised on two
 * machines must not lose one by restoring a code in the wrong order
 * (docs/AI_CONTEXT.md's "Progress Codes"). A look has no union, so `a`'s —
 * this device's, as both callers pass it — wins, and a device that never
 * changed its look takes the code's.
 */
export function mergeProgress(a: PracticeProgress, b: PracticeProgress): PracticeProgress {
  const completedTaskSlugs = [...new Set([...a.completedTaskSlugs, ...b.completedTaskSlugs])];
  const completedTheorySlugs = [...new Set([...(a.completedTheorySlugs ?? []), ...(b.completedTheorySlugs ?? [])])];
  const look = a.look ?? b.look;
  return {
    completedTaskSlugs,
    ...(completedTheorySlugs.length > 0 ? { completedTheorySlugs } : {}),
    ...(look ? { look } : {})
  };
}

export function hasCompletedTask(progress: PracticeProgress, slug: string): boolean {
  return progress.completedTaskSlugs.includes(slug);
}

/** Guards the request body of `POST /api/progress` against a malformed or abusive payload. */
export function isValidPracticeProgress(value: unknown): value is PracticeProgress {
  if (typeof value !== 'object' || value === null) return false;
  const slugs = (value as Record<string, unknown>).completedTaskSlugs;
  if (!Array.isArray(slugs) || slugs.length > MAX_COMPLETED_TASKS) return false;
  const look = (value as Record<string, unknown>).look;
  if (look !== undefined && !isValidStoredLook(look)) return false;
  const theory = (value as Record<string, unknown>).completedTheorySlugs;
  if (theory !== undefined && (!Array.isArray(theory) || theory.length > MAX_COMPLETED_LESSONS || !theory.every(isSlug))) {
    return false;
  }
  return slugs.every(isSlug);
}
