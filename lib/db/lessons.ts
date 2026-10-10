/**
 * Lesson queries (docs/AI_CONTEXT.md, "Course Structure"). Students see only
 * published tasks inside a lesson — a lesson that references a draft simply
 * shows one task fewer until it is published.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { lessonSteps, resolveLessonTasks, type LessonOutlineItem, type LessonTaskStep, type LessonTaskSummary } from '@/lib/lessons/view';
import type { LessonKind } from '@/lib/lessons/types';
import type { PracticeTaskMeta } from '@/lib/meta/progress';
import { isFileDelivery } from '@/lib/task/prerequisite';
import type { Task } from '@/lib/task/types';
import { getDb } from './client';
import { lessons, tasks, topics } from './schema';
import { clampDifficulty, toTask } from './task-mapping';

export interface LessonListItem {
  slug: string;
  order: number;
  kind: LessonKind;
  title: string;
  /** Published tasks a student can open in practice, core and additional — what "done" is counted against. */
  taskSlugs: string[];
}

export interface LessonDetail {
  slug: string;
  grade: number;
  kind: LessonKind;
  title: string;
  explanationMd: string;
  core: LessonTaskSummary[];
  additional: LessonTaskSummary[];
  steps: LessonTaskStep[];
}

async function publishedSummaries(ids: string[]): Promise<Map<string, LessonTaskSummary>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({
      id: tasks.id,
      slug: tasks.slug,
      title: tasks.title,
      type: tasks.type,
      difficulty: tasks.difficulty,
      params: tasks.params,
      topicId: tasks.topicId,
      payload: tasks.payload
    })
    .from(tasks)
    .where(and(inArray(tasks.id, ids), eq(tasks.status, 'published')));
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        slug: row.slug,
        title: row.title,
        type: row.type,
        difficulty: row.difficulty,
        sessionOnly: row.params !== null,
        topicId: row.topicId,
        fileDelivery: isFileDelivery(row.payload)
      }
    ])
  );
}

/** Grades that have at least one lesson, ascending — what the practice page's grade switch offers. */
export async function listLessonGrades(): Promise<number[]> {
  const rows = await getDb().selectDistinct({ grade: lessons.grade }).from(lessons).orderBy(asc(lessons.grade));
  return rows.map((row) => row.grade);
}

export async function listLessons(grade: number): Promise<LessonListItem[]> {
  const rows = await getDb().select().from(lessons).where(eq(lessons.grade, grade)).orderBy(asc(lessons.order));
  const byId = await publishedSummaries([...new Set(rows.flatMap((row) => [...row.coreTaskIds, ...row.additionalTaskIds]))]);
  return rows.map((row) => ({
    slug: row.slug,
    order: row.order,
    kind: row.kind,
    title: row.title,
    taskSlugs: lessonSteps(resolveLessonTasks(row.coreTaskIds, byId), resolveLessonTasks(row.additionalTaskIds, byId)).map(
      (step) => step.slug
    )
  }));
}

/** A grade's lessons in order, slug and title only — what the practice navigation needs for "next lesson". */
export async function listLessonOutline(grade: number): Promise<LessonOutlineItem[]> {
  return getDb()
    .select({ slug: lessons.slug, title: lessons.title })
    .from(lessons)
    .where(eq(lessons.grade, grade))
    .orderBy(asc(lessons.order));
}

export async function getLesson(slug: string): Promise<LessonDetail | null> {
  const [row] = await getDb().select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
  if (!row) return null;
  const byId = await publishedSummaries([...row.coreTaskIds, ...row.additionalTaskIds]);
  const core = resolveLessonTasks(row.coreTaskIds, byId);
  const additional = resolveLessonTasks(row.additionalTaskIds, byId);
  return {
    slug: row.slug,
    grade: row.grade,
    kind: row.kind,
    title: row.title,
    explanationMd: row.explanationMd,
    core,
    additional,
    steps: lessonSteps(core, additional)
  };
}

/** A published task by slug — the practice route checks it belongs to the lesson via `LessonDetail.steps`. */
export async function getPublishedTaskInLesson(lesson: LessonDetail, taskSlug: string): Promise<Task | null> {
  if (!lesson.steps.some((step) => step.slug === taskSlug)) return null;
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.slug, taskSlug), eq(tasks.status, 'published')))
    .limit(1);
  return row ? toTask(row) : null;
}

export interface LessonPickerOption {
  id: string;
  grade: number;
  order: number;
  kind: LessonKind;
  title: string;
  coreTaskIds: string[];
  additionalTaskIds: string[];
}

/** Every lesson, for the session builder's "add a whole lesson" and its graded-mode warning. */
export async function listLessonsForPicker(): Promise<LessonPickerOption[]> {
  return getDb()
    .select({
      id: lessons.id,
      grade: lessons.grade,
      order: lessons.order,
      kind: lessons.kind,
      title: lessons.title,
      coreTaskIds: lessons.coreTaskIds,
      additionalTaskIds: lessons.additionalTaskIds
    })
    .from(lessons)
    .orderBy(asc(lessons.grade), asc(lessons.order));
}

/**
 * Every task a student can open in practice — published, not parameterized,
 * listed in some lesson — with its topic and the grades of the lessons that
 * list it. What XP and topic progress are computed from (lib/meta/progress.ts).
 */
export async function listPracticeTaskMeta(): Promise<PracticeTaskMeta[]> {
  const lessonRows = await getDb()
    .select({ grade: lessons.grade, coreTaskIds: lessons.coreTaskIds, additionalTaskIds: lessons.additionalTaskIds })
    .from(lessons);
  const gradesById = new Map<string, Set<number>>();
  for (const lesson of lessonRows) {
    for (const id of [...lesson.coreTaskIds, ...lesson.additionalTaskIds]) {
      gradesById.set(id, (gradesById.get(id) ?? new Set()).add(lesson.grade));
    }
  }
  if (gradesById.size === 0) return [];
  const rows = await getDb()
    .select({
      id: tasks.id,
      slug: tasks.slug,
      difficulty: tasks.difficulty,
      params: tasks.params,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      topicOrder: topics.order
    })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .where(and(inArray(tasks.id, [...gradesById.keys()]), eq(tasks.status, 'published')));
  return rows
    .filter((row) => row.params === null)
    .map((row) => ({
      slug: row.slug,
      difficulty: clampDifficulty(row.difficulty),
      topicSlug: row.topicSlug,
      topicTitle: row.topicTitle,
      topicOrder: row.topicOrder,
      grades: [...(gradesById.get(row.id) ?? [])]
    }));
}
