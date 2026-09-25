/**
 * Validation of lesson content before it is imported (scripts/db/seed-content.ts).
 * Pure: the caller supplies which task slugs exist, so the same rules run in a
 * unit test and against a real database import.
 */
import { LESSON_KINDS, type LessonContent } from './types';

export interface LessonContentError {
  lesson: string;
  message: string;
}

export function validateLessonContent(
  lessons: readonly LessonContent[],
  knownTaskSlugs: ReadonlySet<string>
): LessonContentError[] {
  const errors: LessonContentError[] = [];
  const seenSlugs = new Set<string>();
  const seenOrders = new Set<string>();

  for (const lesson of lessons) {
    const report = (message: string) => errors.push({ lesson: lesson.slug || '(no slug)', message });

    if (!lesson.slug) report('missing slug');
    if (seenSlugs.has(lesson.slug)) report('duplicate slug');
    seenSlugs.add(lesson.slug);

    if (!Number.isInteger(lesson.grade) || lesson.grade < 1) report(`invalid grade ${lesson.grade}`);
    if (!Number.isInteger(lesson.order) || lesson.order < 1) report(`invalid order ${lesson.order}`);
    const orderKey = `${lesson.grade}:${lesson.order}`;
    if (seenOrders.has(orderKey)) report(`order ${lesson.order} is used twice in grade ${lesson.grade}`);
    seenOrders.add(orderKey);

    if (!LESSON_KINDS.includes(lesson.kind)) report(`invalid kind "${lesson.kind}"`);
    if (!lesson.title?.trim()) report('missing title');

    const allSlugs = [...lesson.coreTaskSlugs, ...lesson.additionalTaskSlugs];
    if (lesson.coreTaskSlugs.length === 0) report('a lesson needs at least one core task');
    const inLesson = new Set<string>();
    for (const slug of allSlugs) {
      if (!knownTaskSlugs.has(slug)) report(`unknown task "${slug}"`);
      if (inLesson.has(slug)) report(`task "${slug}" appears twice`);
      inLesson.add(slug);
    }
  }

  return errors;
}

/** Content lists slugs, the database stores uuids. Throws on a slug the map lacks — validate first. */
export function resolveTaskSlugs(slugs: readonly string[], idsBySlug: ReadonlyMap<string, string>): string[] {
  return slugs.map((slug) => {
    const id = idsBySlug.get(slug);
    if (!id) throw new Error(`resolveTaskSlugs: unknown task "${slug}"`);
    return id;
  });
}

/** A lesson's tasks in the order a student meets them: core first, then additional. */
export function lessonTaskIds(lesson: { coreTaskIds: readonly string[]; additionalTaskIds: readonly string[] }): string[] {
  return [...lesson.coreTaskIds, ...lesson.additionalTaskIds];
}
