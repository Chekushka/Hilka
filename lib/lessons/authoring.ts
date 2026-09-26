/**
 * Teacher-side lesson authoring (docs/TASKS.md, "Lessons"). The same rules
 * the content import enforces (lib/lessons/content.ts's validateLessonContent)
 * applied to one lesson being saved from the form: pure, so the route handler
 * and a unit test run the same checks, and each problem comes back as a
 * stable code the form turns into a Ukrainian message.
 *
 * Tasks are referenced by uuid here, not by slug — a form picks rows that
 * already exist in this database. Draft tasks may be placed in a lesson: every
 * student-facing reader skips anything unpublished, so a lesson can be
 * prepared before its tasks are finished.
 */
import { LESSON_KINDS, type LessonKind } from './types';

export interface LessonDraft {
  slug: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  curriculumRef: string | null;
  explanationMd: string;
  coreTaskIds: string[];
  additionalTaskIds: string[];
}

export type LessonDraftError =
  | 'slug'
  | 'slugTaken'
  | 'grade'
  | 'order'
  | 'orderTaken'
  | 'kind'
  | 'title'
  | 'noCoreTask'
  | 'unknownTask'
  | 'duplicateTask';

/** Lowercase latin, digits, dashes — the content key a git export and a re-seed key on. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ExistingLesson {
  id: string;
  slug: string;
  grade: number;
  order: number;
}

export interface LessonDraftContext {
  /** Every lesson already in the database. */
  lessons: readonly ExistingLesson[];
  /** Every task id that exists, draft or published. */
  knownTaskIds: ReadonlySet<string>;
  /** Set when editing: that lesson does not collide with itself. */
  editingId?: string;
}

export function validateLessonDraft(draft: LessonDraft, context: LessonDraftContext): LessonDraftError[] {
  const errors: LessonDraftError[] = [];
  const others = context.lessons.filter((lesson) => lesson.id !== context.editingId);

  if (!SLUG.test(draft.slug)) errors.push('slug');
  else if (others.some((lesson) => lesson.slug === draft.slug)) errors.push('slugTaken');

  if (!Number.isInteger(draft.grade) || draft.grade < 1 || draft.grade > 12) errors.push('grade');
  if (!Number.isInteger(draft.order) || draft.order < 1) errors.push('order');
  // Not a database constraint (see lessons' index in lib/db/schema.ts), so it is checked here.
  else if (others.some((lesson) => lesson.grade === draft.grade && lesson.order === draft.order)) {
    errors.push('orderTaken');
  }

  if (!LESSON_KINDS.includes(draft.kind)) errors.push('kind');
  if (draft.title.trim() === '') errors.push('title');
  if (draft.coreTaskIds.length === 0) errors.push('noCoreTask');

  const all = [...draft.coreTaskIds, ...draft.additionalTaskIds];
  if (all.some((id) => !context.knownTaskIds.has(id))) errors.push('unknownTask');
  if (new Set(all).size !== all.length) errors.push('duplicateTask');

  return errors;
}

/** The request body's shape, checked before any rule — a route handler's first gate. */
export function isLessonDraftShaped(value: unknown): value is LessonDraft {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const isIdList = (list: unknown) => Array.isArray(list) && list.every((id) => typeof id === 'string');
  return (
    typeof v.slug === 'string' &&
    typeof v.grade === 'number' &&
    typeof v.order === 'number' &&
    typeof v.kind === 'string' &&
    typeof v.title === 'string' &&
    (v.curriculumRef === null || typeof v.curriculumRef === 'string') &&
    typeof v.explanationMd === 'string' &&
    isIdList(v.coreTaskIds) &&
    isIdList(v.additionalTaskIds)
  );
}

/** Trims what a teacher typed; an empty curriculum reference is stored as null, like the seed does. */
export function normalizeLessonDraft(draft: LessonDraft): LessonDraft {
  const curriculumRef = draft.curriculumRef?.trim() ?? '';
  return {
    ...draft,
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    curriculumRef: curriculumRef === '' ? null : curriculumRef
  };
}

/** The next free ministry number in a grade — what a new lesson's form starts with. */
export function nextLessonOrder(lessons: readonly ExistingLesson[], grade: number): number {
  const orders = lessons.filter((lesson) => lesson.grade === grade).map((lesson) => lesson.order);
  return orders.length === 0 ? 1 : Math.max(...orders) + 1;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A path id that is not a uuid is a 404, not a Postgres cast error. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
