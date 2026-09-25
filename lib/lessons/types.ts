/**
 * Lessons are the unit of content (docs/AI_CONTEXT.md, "Course Structure"):
 * a grade's content is an ordered list of lessons, each an explanation plus
 * ordered tasks. A **mandatory** lesson explains something a student cannot
 * skip and is what a graded session should draw from; a **practice** lesson
 * consolidates, is skippable but not recommended to skip. Either may carry
 * **additional** tasks beyond its core set — the way a fast student goes
 * deeper in the same topic rather than ahead into another one.
 */
export type LessonKind = 'mandatory' | 'practice';

export const LESSON_KINDS: readonly LessonKind[] = ['mandatory', 'practice'];

/** A lesson as the database holds it: tasks by uuid, in order. */
export interface Lesson {
  id: string;
  slug: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  /** The ministry programme's lesson number(s), e.g. "7:31-32" — a reference, never a schedule. */
  curriculumRef: string | null;
  explanationMd: string;
  coreTaskIds: string[];
  additionalTaskIds: string[];
}

/** A lesson as content/lessons/ holds it: tasks by slug, explanation in its own .md file. */
export interface LessonContent {
  slug: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  curriculumRef?: string;
  coreTaskSlugs: string[];
  additionalTaskSlugs: string[];
}

/** How a task sits in a lesson — what the session builder's graded-mode warning reads. */
export type LessonTaskRole = 'core' | 'additional';
