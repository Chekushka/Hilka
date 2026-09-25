/**
 * Session queries. A session is "open" exactly while `closesAt` is null — the
 * same invariant that lets `sessions.code` be recycled (docs/AI_CONTEXT.md) —
 * so every lookup here filters on it rather than trusting a client-supplied
 * state.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { JoinedSession, SessionTaskSummary } from '@/lib/session/types';
import { getDb } from './client';
import { classes, sessions, tasks } from './schema';
import { orderSessionTasks } from './session-mapping';

export interface TeacherSessionDetail {
  id: string;
  code: string;
  classTitle: string;
  /** `closesAt === null` — drives the dashboard's polling and the "still open" note. */
  open: boolean;
  /** 'graded' sessions get a suggested grade per student (lib/grading/). */
  mode: 'practice' | 'graded';
  roster: string[];
  /** The session's assigned tasks, in the order a student meets them — the "who is stuck" rollup's columns. */
  tasks: SessionTaskSummary[];
}

/** A session detail, but only for the teacher who owns its class — never another teacher's. */
export async function getSessionForTeacher(
  sessionId: string,
  teacherId: string
): Promise<TeacherSessionDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({ session: sessions, classTitle: classes.title, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.id, sessionId), eq(classes.teacherId, teacherId)))
    .limit(1);
  if (!row) return null;

  const taskRows = row.session.taskIds.length
    ? await db
        .select({ id: tasks.id, slug: tasks.slug, title: tasks.title, difficulty: tasks.difficulty })
        .from(tasks)
        .where(inArray(tasks.id, row.session.taskIds))
    : [];

  return {
    id: row.session.id,
    code: row.session.code,
    classTitle: row.classTitle,
    open: row.session.closesAt === null,
    mode: row.session.mode,
    roster: row.roster,
    tasks: orderSessionTasks(row.session.taskIds, taskRows)
  };
}

export async function getOpenSessionByCode(code: string): Promise<JoinedSession | null> {
  const db = getDb();
  const [row] = await db
    .select({ session: sessions, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.code, code.toUpperCase()), isNull(sessions.closesAt)))
    .limit(1);
  if (!row) return null;

  const taskRows = row.session.taskIds.length
    ? await db
        .select({ id: tasks.id, slug: tasks.slug, title: tasks.title, difficulty: tasks.difficulty })
        .from(tasks)
        .where(inArray(tasks.id, row.session.taskIds))
    : [];

  return {
    id: row.session.id,
    mode: row.session.mode,
    roster: row.roster,
    tasks: orderSessionTasks(row.session.taskIds, taskRows),
    hintsEnabled: row.session.hintsEnabled,
    timeLimitS: row.session.timeLimitS
  };
}

/**
 * Everything an attempt submission must be checked against, in one query:
 * the session is open, the task belongs to it, and the student is on the
 * class roster. A client can lie about all three, so the API route re-derives
 * this rather than trusting the request body.
 */
export async function validateAttemptContext(
  sessionId: string,
  taskId: string,
  studentName: string
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ taskIds: sessions.taskIds, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.id, sessionId), isNull(sessions.closesAt)))
    .limit(1);
  if (!row) return false;
  return row.taskIds.includes(taskId) && row.roster.includes(studentName);
}
