/**
 * Session queries: join by code, re-validate before an attempt is recorded.
 *
 * "Open" means the current moment falls inside [opensAt, closesAt), with a
 * null bound meaning unbounded on that side — the same window a teacher sets
 * once in the session builder and never has to think about again.
 */
import { and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { CodeTask } from '@/lib/task/types';
import { isValidSessionCode, normalizeSessionCode } from '@/lib/session/code';
import type { JoinableSession } from '@/lib/session/types';
import { getDb } from './client';
import { attempts, classes, sessions, tasks } from './schema';
import { toCodeTask } from './task-mapping';

const openWindow = and(
  or(isNull(sessions.closesAt), gt(sessions.closesAt, sql`now()`)),
  or(isNull(sessions.opensAt), lte(sessions.opensAt, sql`now()`))
);

async function hydrateSessionTasks(taskIds: string[]): Promise<CodeTask[]> {
  if (taskIds.length === 0) {
    return [];
  }
  const rows = await getDb().select().from(tasks).where(inArray(tasks.id, taskIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  // task_ids is the author's chosen order, not a database default — the
  // database has no reason to return rows in that order on its own.
  return taskIds
    .map((id) => byId.get(id))
    .filter((row) => row !== undefined)
    .map(toCodeTask)
    .filter((task): task is CodeTask => task !== null);
}

interface SessionJoinRow {
  session: typeof sessions.$inferSelect;
  className: string;
  roster: string[];
}

async function toJoinableSession(row: SessionJoinRow): Promise<JoinableSession> {
  return {
    id: row.session.id,
    code: row.session.code,
    mode: row.session.mode,
    hintsEnabled: row.session.hintsEnabled,
    timeLimitS: row.session.timeLimitS,
    className: row.className,
    roster: row.roster,
    tasks: await hydrateSessionTasks(row.session.taskIds)
  };
}

/** The student's entry point: a six-character code, normalized and validated
 *  before it ever touches the database. Returns null for an invalid code, an
 *  unknown one, and a real-but-closed one alike — the join screen shows the
 *  same calm "not available" state for all three; which one it was is not the
 *  student's problem to diagnose. */
export async function findOpenSessionByCode(rawCode: string): Promise<JoinableSession | null> {
  const code = normalizeSessionCode(rawCode);
  if (!isValidSessionCode(code)) {
    return null;
  }

  const [row] = await getDb()
    .select({ session: sessions, className: classes.title, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.code, code), openWindow))
    .limit(1);

  return row ? toJoinableSession(row) : null;
}

/** Re-validated before every attempt: the client's copy of the session may be
 *  stale by the time a student clicks "Перевірити" — a session closed mid-task
 *  must not accept a late attempt just because the page was already open. */
export async function getOpenSessionById(id: string): Promise<JoinableSession | null> {
  const [row] = await getDb()
    .select({ session: sessions, className: classes.title, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.id, id), openWindow))
    .limit(1);

  return row ? toJoinableSession(row) : null;
}

/**
 * Attempts are append-only (docs/AI_CONTEXT.md): a retry is a new row, never
 * an update, so "best attempt" stays a query rather than something that can
 * silently overwrite an earlier try.
 *
 * `score` and `flags` are left null — grading and the paste/edit/speed
 * heuristics are not built yet (docs/TASKS.md).
 */
export async function recordAttempt(input: {
  sessionId: string;
  studentName: string;
  taskId: string;
  taskVersion: number;
  code: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
}): Promise<void> {
  await getDb()
    .insert(attempts)
    .values({
      sessionId: input.sessionId,
      studentName: input.studentName,
      taskId: input.taskId,
      taskVersion: input.taskVersion,
      submittedAnswer: { code: input.code },
      passed: input.passed,
      hintsUsed: input.hintsUsed,
      durationMs: input.durationMs
    });
}
