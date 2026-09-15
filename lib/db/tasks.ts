/**
 * Task queries. Students only ever see published rows — drafts are invisible,
 * which is what makes it safe to edit a task while a class is working.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { CodeTask } from '@/lib/task/types';
import { getDb } from './client';
import { tasks, topics } from './schema';
import { toCodeTask } from './task-mapping';

export async function getPublishedCodeTask(slug: string): Promise<CodeTask | null> {
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.slug, slug), eq(tasks.status, 'published')))
    .limit(1);
  return row ? toCodeTask(row) : null;
}

/** Same rule as `getPublishedCodeTask`, keyed by id — a session stores ids. */
export async function getPublishedCodeTaskById(id: string): Promise<CodeTask | null> {
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.status, 'published')))
    .limit(1);
  return row ? toCodeTask(row) : null;
}

/** Published tasks of one topic, in the order a student should meet them. */
export async function listPublishedTasks(topicSlug: string): Promise<CodeTask[]> {
  const rows = await getDb()
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .where(and(eq(topics.slug, topicSlug), eq(tasks.status, 'published')))
    .orderBy(asc(tasks.difficulty), asc(tasks.slug));
  return rows.map((row) => toCodeTask(row.task)).filter((task): task is CodeTask => task !== null);
}
