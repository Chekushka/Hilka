/**
 * Lesson authoring writes and the reads the authoring pages need. Distinct from
 * lib/db/lessons.ts, the student-facing read side, which sees published tasks
 * only; here every task is listed, drafts included, because a lesson may be
 * prepared before its tasks are published. Only teacher route handlers and
 * server components call this (CLAUDE.md rule 4).
 */
import { asc, eq } from 'drizzle-orm';
import type { ExistingLesson, LessonDraft } from '@/lib/lessons/authoring';
import type { LessonKind } from '@/lib/lessons/types';
import type { TaskStatus, TaskType } from '@/lib/task/types';
import { getDb } from './client';
import { lessons, tasks, topics } from './schema';

export interface LessonAuthoringItem {
  id: string;
  slug: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  coreCount: number;
  additionalCount: number;
}

export async function listLessonsForAuthoring(): Promise<LessonAuthoringItem[]> {
  const rows = await getDb().select().from(lessons).orderBy(asc(lessons.grade), asc(lessons.order));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    grade: row.grade,
    order: row.order,
    kind: row.kind,
    title: row.title,
    coreCount: row.coreTaskIds.length,
    additionalCount: row.additionalTaskIds.length
  }));
}

/** What validateLessonDraft needs to know about every other lesson. */
export async function listExistingLessons(): Promise<ExistingLesson[]> {
  return getDb().select({ id: lessons.id, slug: lessons.slug, grade: lessons.grade, order: lessons.order }).from(lessons);
}

export async function getLessonForAuthoring(id: string): Promise<(LessonDraft & { id: string }) | null> {
  const [row] = await getDb().select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    grade: row.grade,
    order: row.order,
    kind: row.kind,
    title: row.title,
    curriculumRef: row.curriculumRef,
    explanationMd: row.explanationMd,
    coreTaskIds: row.coreTaskIds,
    additionalTaskIds: row.additionalTaskIds
  };
}

export interface LessonTaskOption {
  id: string;
  slug: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  difficulty: number;
  gradeTags: number[];
  topicTitle: string;
  /** Parameterized: listed in a lesson, but only openable in a session. */
  sessionOnly: boolean;
}

/** Every task except archived ones, in curriculum order — the lesson form's picker. */
export async function listLessonTaskOptions(): Promise<LessonTaskOption[]> {
  const rows = await getDb()
    .select({
      id: tasks.id,
      slug: tasks.slug,
      title: tasks.title,
      type: tasks.type,
      status: tasks.status,
      difficulty: tasks.difficulty,
      gradeTags: tasks.gradeTags,
      params: tasks.params,
      topicTitle: topics.title
    })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .orderBy(asc(topics.order), asc(tasks.difficulty), asc(tasks.title));
  return rows
    .filter((row) => row.status !== 'archived')
    .map(({ params, ...row }) => ({ ...row, sessionOnly: params !== null }));
}

export async function listTaskIds(): Promise<Set<string>> {
  const rows = await getDb().select({ id: tasks.id }).from(tasks);
  return new Set(rows.map((row) => row.id));
}

export async function createLesson(draft: LessonDraft): Promise<{ id: string }> {
  const [row] = await getDb().insert(lessons).values(draft).returning({ id: lessons.id });
  return row;
}

/** False when no such lesson exists. */
export async function updateLesson(id: string, draft: LessonDraft): Promise<boolean> {
  const rows = await getDb().update(lessons).set(draft).where(eq(lessons.id, id)).returning({ id: lessons.id });
  return rows.length > 0;
}

/**
 * Nothing references a lesson by key — sessions keep their own task ids, and
 * progress is per task — so removing one only removes it from the lesson list.
 */
export async function deleteLesson(id: string): Promise<boolean> {
  const rows = await getDb().delete(lessons).where(eq(lessons.id, id)).returning({ id: lessons.id });
  return rows.length > 0;
}
