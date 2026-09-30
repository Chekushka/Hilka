/**
 * Task queries. Students only ever see published rows — drafts are invisible,
 * which is what makes it safe to edit a task while a class is working.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Task, TaskPayload, TaskType } from '@/lib/task/types';
import { getDb } from './client';
import { tasks, topics } from './schema';
import { toTask } from './task-mapping';

export async function getPublishedTask(slug: string): Promise<Task | null> {
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.slug, slug), eq(tasks.status, 'published')))
    .limit(1);
  return row ? toTask(row) : null;
}

/** Same rule as `getPublishedTask`, keyed by id — a session stores ids. */
export async function getPublishedTaskById(id: string): Promise<Task | null> {
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.status, 'published')))
    .limit(1);
  return row ? toTask(row) : null;
}

/** Published tasks of one topic, in the order a student should meet them. */
export async function listPublishedTasks(topicSlug: string): Promise<Task[]> {
  const rows = await getDb()
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .where(and(eq(topics.slug, topicSlug), eq(tasks.status, 'published')))
    .orderBy(asc(tasks.difficulty), asc(tasks.slug));
  return rows.map((row) => toTask(row.task)).filter((task): task is Task => task !== null);
}

export interface TaskContent {
  id: string;
  type: TaskType;
  version: number;
  payload: TaskPayload;
}

/**
 * Type, version and payload of the given tasks, whatever their status — for
 * reading back what a student submitted (lib/dashboard/submitted-answer.ts).
 * Teacher-side only: a student never reaches a task through this.
 */
export async function listTaskContent(ids: string[]): Promise<TaskContent[]> {
  if (ids.length === 0) return [];
  return getDb()
    .select({ id: tasks.id, type: tasks.type, version: tasks.version, payload: tasks.payload })
    .from(tasks)
    .where(inArray(tasks.id, ids));
}
