/**
 * Session builder writes (docs/TASKS.md, "Session builder"). Distinct from
 * lib/db/sessions.ts, which is the join-side read path — this is the
 * teacher-side create path, the same split task-authoring.ts draws against
 * lib/db/tasks.ts.
 */
import { randomInt } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from '@/lib/session/code';
import type { StudentRoutes } from '@/lib/session/routes';
import type { SessionKind, SessionMode } from '@/lib/session/types';
import { isFileDelivery } from '@/lib/task/prerequisite';
import { normalizeTags, type TaskTag } from '@/lib/task/tags';
import type { TaskType } from '@/lib/task/types';
import { getDb } from './client';
import { classes, sessions, tasks, topics } from './schema';

const MAX_MINT_ATTEMPTS = 5;

function generateSessionCode(): string {
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[randomInt(SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

export interface TaskPickerOption {
  id: string;
  slug: string;
  title: string;
  topicSlug: string;
  topicTitle: string;
  gradeTags: number[];
  difficulty: number;
  /** With `fileDelivery`, what the builder's sequencing warning reads (lib/task/prerequisite.ts). */
  type: TaskType;
  fileDelivery: boolean;
  /** Each student gets their own variant (`tasks.params`, lib/task/params.ts). */
  parameterized: boolean;
  /** What kind of work it is (lib/task/tags.ts) — what the routes are filled from. */
  tags: TaskTag[];
}

/** Every published task, for the builder's own client-side topic/grade filtering — the catalog is small enough not to need a filtered query. */
export async function listPublishedTasksForPicker(): Promise<TaskPickerOption[]> {
  const rows = await getDb()
    .select({
      id: tasks.id,
      slug: tasks.slug,
      title: tasks.title,
      topicSlug: topics.slug,
      topicTitle: topics.title,
      gradeTags: tasks.gradeTags,
      difficulty: tasks.difficulty,
      type: tasks.type,
      payload: tasks.payload,
      params: tasks.params,
      tags: tasks.tags
    })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .where(eq(tasks.status, 'published'))
    .orderBy(asc(topics.order), asc(tasks.slug));
  return rows.map(({ payload, params, ...row }) => ({
    ...row,
    fileDelivery: isFileDelivery(payload),
    parameterized: params !== null,
    tags: normalizeTags(row.tags)
  }));
}

export interface BuilderClassOption {
  id: string;
  title: string;
  grade: number | null;
  /** Ids and names only — who can be put on a route. */
  students: { id: string; name: string }[];
  /** The routes of this class's latest session that had any, for «як минулого разу»; empty when none did. */
  lastRoutes: StudentRoutes;
}

/**
 * The teacher's classes for the session builder, each with its roster and the
 * routes its latest session used. Routes are read from that session, never
 * stored on the class: a teacher repeats a choice, the class carries no label.
 */
export async function listClassesForBuilder(teacherId: string): Promise<BuilderClassOption[]> {
  const db = getDb();
  const rows = await db
    .select({ id: classes.id, title: classes.title, grade: classes.grade, students: classes.students })
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(asc(classes.title));
  if (rows.length === 0) return [];
  const routed = await db
    .select({ classId: sessions.classId, studentRoutes: sessions.studentRoutes })
    .from(sessions)
    .where(
      and(
        inArray(
          sessions.classId,
          rows.map((row) => row.id)
        ),
        sql`${sessions.studentRoutes} <> '{}'::jsonb`
      )
    )
    .orderBy(desc(sessions.createdAt));
  const latest = new Map<string, StudentRoutes>();
  for (const row of routed) if (!latest.has(row.classId)) latest.set(row.classId, row.studentRoutes);
  return rows.map((row) => {
    const onRoster = new Set(row.students.map((student) => student.id));
    const last = latest.get(row.id) ?? {};
    return {
      id: row.id,
      title: row.title,
      grade: row.grade,
      students: row.students.map(({ id, name }) => ({ id, name })),
      // A student removed from the roster since is left out.
      lastRoutes: Object.fromEntries(Object.entries(last).filter(([id]) => onRoster.has(id)))
    };
  });
}

/** Narrows a teacher-submitted task id list down to ones that are actually published, in the order given. */
export async function filterToPublishedTaskIds(candidateIds: string[]): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const rows = await getDb()
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.id, candidateIds), eq(tasks.status, 'published')));
  const published = new Set(rows.map((row) => row.id));
  return candidateIds.filter((id) => published.has(id));
}

export interface CreateSessionInput {
  classId: string;
  mode: SessionMode;
  kind: SessionKind;
  taskIds: string[];
  improvementTaskIds: string[];
  timeLimitS: number | null;
  hintsEnabled: boolean;
  shuffle: boolean;
  /** Each student gets this many of `taskIds`; null for all. */
  poolSize?: number | null;
  dueAt: Date | null;
  /** A class check only: the homework it checks. */
  checksSessionId?: string | null;
  /** Routes (lib/session/routes.ts): extra tasks per route, and who is on which. */
  supportTaskIds?: string[];
  extensionTaskIds?: string[];
  studentRoutes?: StudentRoutes;
}

/**
 * Mints a code unique among open sessions and inserts the row. Codes are
 * recycled once a session closes (docs/AI_CONTEXT.md), so the retry here is
 * only against another *currently open* session, not the whole table's
 * history — collisions are correspondingly more likely than the 8-char
 * practice code's, hence the same bounded-retry shape as
 * `lib/db/progress-codes.ts`'s `mintProgressCode`.
 */
export async function createSession(input: CreateSessionInput): Promise<{ id: string; code: string }> {
  const db = getDb();
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt++) {
    const code = generateSessionCode();
    const [row] = await db
      .insert(sessions)
      .values({
        classId: input.classId,
        code,
        mode: input.mode,
        kind: input.kind,
        taskIds: input.taskIds,
        improvementTaskIds: input.improvementTaskIds,
        timeLimitS: input.timeLimitS,
        hintsEnabled: input.hintsEnabled,
        shuffle: input.shuffle,
        poolSize: input.poolSize ?? null,
        dueAt: input.dueAt,
        checksSessionId: input.checksSessionId ?? null,
        supportTaskIds: input.supportTaskIds ?? [],
        extensionTaskIds: input.extensionTaskIds ?? [],
        studentRoutes: input.studentRoutes ?? {}
      })
      .onConflictDoNothing()
      .returning({ id: sessions.id, code: sessions.code });
    if (row) return row;
  }
  throw new Error('createSession: exhausted retries — too many currently open sessions share this code space');
}
