/**
 * Session queries. A session is "open" exactly while `closesAt` is null — the
 * same invariant that lets `sessions.code` be recycled (docs/AI_CONTEXT.md) —
 * so every lookup here filters on it rather than trusting a client-supplied
 * state.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { SessionRules } from '@/lib/homework/rules';
import type {
  JoinedSession,
  JoinedSessionTask,
  OwnAttempt,
  SessionKind,
  SessionMode,
  SessionTaskSummary
} from '@/lib/session/types';
import { isFileDelivery } from '@/lib/task/prerequisite';
import { getDb, type Database, type Executor } from './client';
import { attempts, classes, sessions, tasks } from './schema';
import { orderSessionTasks } from './session-mapping';

export interface TeacherSessionDetail {
  id: string;
  classId: string;
  code: string;
  classTitle: string;
  /** `closesAt === null` — drives the dashboard's polling and the "still open" note. */
  open: boolean;
  /** 'graded' sessions get a suggested grade per student (lib/grading/). */
  mode: SessionMode;
  /** 'homework' grades with lib/homework/grade.ts and shows the deadline and devices. */
  kind: SessionKind;
  /** Homework only, ISO. */
  dueAt: string | null;
  roster: string[];
  /** The session's assigned tasks, in the order a student meets them — the "who is stuck" rollup's columns. */
  tasks: SessionTaskSummary[];
  /** Homework only. */
  improvementTasks: SessionTaskSummary[];
  /** A class check only: the homework it checks, by id and code. */
  checks: { id: string; code: string } | null;
}

/** A class check of a homework, as the homework's page lists it. */
export interface ClassCheckSummary {
  id: string;
  code: string;
  open: boolean;
  taskCount: number;
}

async function taskSummaries(db: Database, ids: string[]): Promise<SessionTaskSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: tasks.id, slug: tasks.slug, title: tasks.title, difficulty: tasks.difficulty })
    .from(tasks)
    .where(inArray(tasks.id, ids));
  return orderSessionTasks(ids, rows);
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

  const [checked] = row.session.checksSessionId
    ? await db
        .select({ id: sessions.id, code: sessions.code })
        .from(sessions)
        .where(eq(sessions.id, row.session.checksSessionId))
        .limit(1)
    : [];

  return {
    id: row.session.id,
    classId: row.session.classId,
    code: row.session.code,
    classTitle: row.classTitle,
    open: row.session.closesAt === null,
    mode: row.session.mode,
    kind: row.session.kind,
    dueAt: row.session.dueAt?.toISOString() ?? null,
    roster: row.roster,
    tasks: await taskSummaries(db, row.session.taskIds),
    improvementTasks: await taskSummaries(db, row.session.improvementTaskIds),
    checks: checked ?? null
  };
}

/** The class checks of a homework, by code (sessions keep no creation time). The caller has checked the homework is the teacher's. */
export async function listClassChecks(homeworkId: string): Promise<ClassCheckSummary[]> {
  const rows = await getDb()
    .select({ id: sessions.id, code: sessions.code, closesAt: sessions.closesAt, taskIds: sessions.taskIds })
    .from(sessions)
    .where(eq(sessions.checksSessionId, homeworkId))
    .orderBy(asc(sessions.code));
  return rows.map((row) => ({ id: row.id, code: row.code, open: row.closesAt === null, taskCount: row.taskIds.length }));
}

/** One Check in a class check, for the homework's grade (lib/homework/grade.ts). */
export interface CheckAttemptRow {
  studentName: string;
  taskId: string;
  passed: boolean;
  createdAt: string;
}

/** Every Check that counts in every class check of a homework. */
export async function listCheckAttempts(homeworkId: string): Promise<CheckAttemptRow[]> {
  const rows = await getDb()
    .select({
      studentName: attempts.studentName,
      taskId: attempts.taskId,
      passed: attempts.passed,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
    .where(and(eq(sessions.checksSessionId, homeworkId), isNull(attempts.voidedAt)));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
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

  const allIds = [...row.session.taskIds, ...row.session.improvementTaskIds];
  const taskRows = allIds.length
    ? await db
        .select({
          id: tasks.id,
          slug: tasks.slug,
          title: tasks.title,
          difficulty: tasks.difficulty,
          type: tasks.type,
          topicId: tasks.topicId,
          payload: tasks.payload
        })
        .from(tasks)
        .where(inArray(tasks.id, allIds))
    : [];
  const joined: JoinedSessionTask[] = taskRows.map(({ payload, ...task }) => ({
    ...task,
    fileDelivery: isFileDelivery(payload)
  }));

  return {
    id: row.session.id,
    mode: row.session.mode,
    kind: row.session.kind,
    roster: row.roster,
    tasks: orderSessionTasks(row.session.taskIds, joined),
    improvementTasks: orderSessionTasks(row.session.improvementTaskIds, joined),
    hintsEnabled: row.session.hintsEnabled,
    timeLimitS: row.session.timeLimitS,
    dueAt: row.session.dueAt?.toISOString() ?? null
  };
}

/** What an attempt is checked against: the open session's rules, if the task and the name belong to it. */
export interface AttemptContext {
  rules: SessionRules;
}

/**
 * Everything an attempt submission must be checked against, in one query:
 * the session is open, the task belongs to it (as a main or an improvement
 * task), and the student is on the class roster. A client can lie about all
 * three, so the API route re-derives this rather than trusting the request body.
 */
export async function getAttemptContext(
  sessionId: string,
  taskId: string,
  studentName: string
): Promise<AttemptContext | null> {
  const [row] = await getDb()
    .select({ session: sessions, roster: classes.roster })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.id, sessionId), isNull(sessions.closesAt)))
    .limit(1);
  if (!row) return null;
  const { taskIds, improvementTaskIds, kind, mode } = row.session;
  if (!taskIds.includes(taskId) && !improvementTaskIds.includes(taskId)) return null;
  if (!row.roster.includes(studentName)) return null;
  return { rules: { kind, mode, taskIds, improvementTaskIds } };
}

export interface OwnAttemptRow extends OwnAttempt {
  deviceId: string | null;
}

/** One name's attempts in one session, voided ones left out, oldest first — what the rules read. */
export async function listOwnAttempts(sessionId: string, studentName: string, db: Executor = getDb()): Promise<OwnAttemptRow[]> {
  const rows = await db
    .select({
      taskId: attempts.taskId,
      passed: attempts.passed,
      score: attempts.score,
      hintsUsed: attempts.hintsUsed,
      deviceId: attempts.deviceId,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .where(
      and(eq(attempts.sessionId, sessionId), eq(attempts.studentName, studentName), isNull(attempts.voidedAt))
    )
    .orderBy(asc(attempts.createdAt));
  return rows.map((row) => ({
    ...row,
    score: row.score === null ? null : Number(row.score),
    createdAt: row.createdAt.toISOString()
  }));
}

/**
 * Serializes attempts by one name on one task: two Checks sent at once (a
 * double click, two tabs) must not both count as the first. Held until the
 * surrounding transaction ends.
 */
export async function lockStudentTask(db: Executor, sessionId: string, studentName: string, taskId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`${sessionId}|${studentName}|${taskId}`}))`);
}

/** The teacher's own session row, for the actions below; null when it is not theirs. */
async function ownedSessionId(sessionId: string, teacherId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .innerJoin(classes, eq(sessions.classId, classes.id))
    .where(and(eq(sessions.id, sessionId), eq(classes.teacherId, teacherId)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Closes a session: its code stops working and returns to the pool. Nothing
 * closed a session before homework existed — a lesson stayed open until the
 * database was edited — so this serves lessons too.
 */
export async function closeSession(sessionId: string, teacherId: string): Promise<boolean> {
  const id = await ownedSessionId(sessionId, teacherId);
  if (!id) return false;
  await getDb()
    .update(sessions)
    .set({ closesAt: new Date() })
    .where(and(eq(sessions.id, id), isNull(sessions.closesAt)));
  return true;
}

/** Moves a homework's deadline. Late credit is computed when grades are read, so past attempts follow. */
export async function setSessionDueAt(sessionId: string, teacherId: string, dueAt: Date): Promise<boolean> {
  const id = await ownedSessionId(sessionId, teacherId);
  if (!id) return false;
  await getDb()
    .update(sessions)
    .set({ dueAt })
    .where(and(eq(sessions.id, id), eq(sessions.kind, 'homework')));
  return true;
}

/**
 * Cancels every attempt one device made under one name (docs/HOMEWORK.md,
 * section 2): someone else worked as this student. The attempts stay in the
 * table, marked, so the student card can still show what happened; they no
 * longer count, and the tries they used are free again.
 */
export async function voidDeviceAttempts(
  sessionId: string,
  teacherId: string,
  studentName: string,
  deviceId: string
): Promise<number | null> {
  const id = await ownedSessionId(sessionId, teacherId);
  if (!id) return null;
  const rows = await getDb()
    .update(attempts)
    .set({ voidedAt: new Date() })
    .where(
      and(
        eq(attempts.sessionId, id),
        eq(attempts.studentName, studentName),
        eq(attempts.deviceId, deviceId),
        isNull(attempts.voidedAt)
      )
    )
    .returning({ id: attempts.id });
  return rows.length;
}
