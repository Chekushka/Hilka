/**
 * Task authoring writes — draft create/edit and the publish gate. Distinct
 * from lib/db/tasks.ts, which is the student-facing read side (published
 * rows only). A teacher route handler is the only caller (CLAUDE.md rule 4).
 *
 * A task can be freely edited while `status = 'draft'`. Publishing is a
 * one-way move per version: it requires `status = 'draft'` going in, so a
 * published task is not editable here — re-drafting a published task is
 * separate, unbuilt work (docs/TASKS.md, "Draft / publish + version bump").
 *
 * `version` starts at 0 — a fresh draft has never been published — and
 * `publishTask` increments it, so a task's first publish lands on version 1,
 * matching content/seed-tasks/ (imported already published, at version 1
 * with no draft history). A later re-draft-and-republish, once that flow
 * exists, would land on 2.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Check } from '@/lib/checker';
import type { CodePayload, Reference } from '@/lib/task/types';
import { getDb } from './client';
import { tasks } from './schema';
import type { TaskRow } from './task-mapping';

export interface DraftTaskInput {
  slug: string;
  topicId: string;
  title: string;
  payload: CodePayload;
  checks: Check[];
  hints: string[];
  difficulty: number;
  gradeTags: number[];
}

/** True for a Postgres unique-violation — the slug is already taken. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

export async function createDraftTask(input: DraftTaskInput): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(tasks)
    .values({
      slug: input.slug,
      topicId: input.topicId,
      type: 'code',
      title: input.title,
      payload: input.payload,
      checks: input.checks,
      hints: input.hints,
      difficulty: input.difficulty,
      gradeTags: input.gradeTags,
      version: 0,
      status: 'draft'
    })
    .returning({ id: tasks.id });
  return row;
}

export async function getTaskForAuthoring(id: string): Promise<TaskRow | null> {
  const [row] = await getDb().select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

/** `null` when the task does not exist or is no longer a draft — a published task is not editable here. */
export async function updateDraftTask(
  id: string,
  input: Partial<Omit<DraftTaskInput, 'slug' | 'topicId'>>
): Promise<TaskRow | null> {
  const [row] = await getDb()
    .update(tasks)
    .set(input)
    .where(and(eq(tasks.id, id), eq(tasks.status, 'draft')))
    .returning();
  return row ?? null;
}

/**
 * The publish gate itself lives in the route handler, which evaluates the
 * reference run before calling this — this function only ever performs a
 * publish that has already been decided. `null` means the task was not a
 * draft anymore (already published, or concurrently published elsewhere),
 * which the route handler reports rather than silently overwriting.
 */
export async function publishTask(id: string, reference: Reference): Promise<TaskRow | null> {
  const [row] = await getDb()
    .update(tasks)
    .set({ reference, status: 'published', version: sql`${tasks.version} + 1` })
    .where(and(eq(tasks.id, id), eq(tasks.status, 'draft')))
    .returning();
  return row ?? null;
}
