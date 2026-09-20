/**
 * Session builder writes (docs/TASKS.md, "Session builder"). Distinct from
 * lib/db/sessions.ts, which is the join-side read path — this is the
 * teacher-side create path, the same split task-authoring.ts draws against
 * lib/db/tasks.ts.
 */
import { randomInt } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { SessionMode } from '@/lib/session/types';
import { getDb } from './client';
import { sessions, tasks, topics } from './schema';

const SESSION_CODE_LENGTH = 6;
/** Same rationale as the practice progress code's alphabet (lib/practice/code.ts): legible from the back row. */
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
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
      difficulty: tasks.difficulty
    })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .where(eq(tasks.status, 'published'))
    .orderBy(asc(topics.order), asc(tasks.slug));
  return rows;
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
  taskIds: string[];
  timeLimitS: number | null;
  hintsEnabled: boolean;
  shuffle: boolean;
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
        taskIds: input.taskIds,
        timeLimitS: input.timeLimitS,
        hintsEnabled: input.hintsEnabled,
        shuffle: input.shuffle
      })
      .onConflictDoNothing()
      .returning({ id: sessions.id, code: sessions.code });
    if (row) return row;
  }
  throw new Error('createSession: exhausted retries — too many currently open sessions share this code space');
}
