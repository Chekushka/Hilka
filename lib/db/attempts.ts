/**
 * Attempts are append-only (docs/AI_CONTEXT.md) — a retry is a new row, and
 * "best attempt" is a query, not an update. Grading (score, most flags,
 * parameterized seeds) is future work; this records the signal that exists
 * today. The one flag recorded so far is `sourceHash`, on file-delivery
 * attempts only (lib/dashboard/shared-files.ts).
 */
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FileSubmissionRow } from '@/lib/dashboard/submitted-files';
import type { AttemptInput } from '@/lib/session/types';
import type { FactAttempt } from '@/lib/homework/facts';
import { parseActivity, type EditorActivity } from '@/lib/task/activity';
import { attempts, tasks } from './schema';
import { getDb, type Executor } from './client';
import { attemptStudentName } from './students';

export interface SessionAttemptRow {
  id: string;
  /** The roster entry's id — what everything groups by. */
  studentId: string;
  /** The student's current name (lib/db/students.ts). */
  studentName: string;
  taskId: string;
  taskTitle: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number | null;
  /** 0..1, the share of input cases passed; null for task types without cases and for older rows. */
  score: number | null;
  /** SHA-256 of the uploaded source; null for anything that was not a file upload. */
  sourceHash: string | null;
  /** The browser it came from (lib/session/device-cookie.ts); null for attempts from before device marks. */
  deviceId: string | null;
  /** Homework only: paste and edit counts (lib/task/activity.ts); null elsewhere. */
  activity: EditorActivity | null;
  createdAt: string;
}

/**
 * Hash of a file-delivery submission. `code` is already normalized by the
 * browser's upload validation (no BOM, LF endings), so two byte-identical
 * files and the same file saved on Windows and elsewhere hash alike.
 */
export function hashSource(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Every attempt in a session that still counts, task title joined in — newest
 * first per student. Voided attempts (lib/db/sessions.ts, `voidDeviceAttempts`)
 * are left out, so every tally, grade and export built on this ignores them.
 */
export async function listAttemptsForSession(sessionId: string): Promise<SessionAttemptRow[]> {
  const rows = await getDb()
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      studentName: attemptStudentName,
      taskId: attempts.taskId,
      taskTitle: tasks.title,
      passed: attempts.passed,
      hintsUsed: attempts.hintsUsed,
      durationMs: attempts.durationMs,
      score: attempts.score,
      flags: attempts.flags,
      deviceId: attempts.deviceId,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(and(eq(attempts.sessionId, sessionId), isNull(attempts.voidedAt)))
    .orderBy(asc(attempts.studentId), desc(attempts.createdAt));
  return rows.map(({ flags, score, ...row }) => ({
    ...row,
    score: score === null ? null : Number(score),
    sourceHash: typeof flags?.sourceHash === 'string' ? flags.sourceHash : null,
    activity: parseActivity(flags?.activity),
    createdAt: row.createdAt.toISOString()
  }));
}

export interface StudentAttemptRow extends SessionAttemptRow {
  taskVersion: number;
  /** Set when the teacher cancelled this device's attempts; shown, never counted. */
  voidedAt: string | null;
  /** As the task-type view reported it (lib/task/types.ts, `AttemptOutcome`); read with lib/dashboard/submitted-answer.ts. */
  submittedAnswer: Record<string, unknown> | null;
}

/**
 * One student's attempts in one session, newest first, with what they
 * submitted — the student card. Voided ones included and marked, so the card
 * can show what was cancelled; nothing that counts reads this. The caller has already checked that the
 * session is the teacher's own (`getSessionForTeacher`).
 */
export async function listAttemptsForStudent(sessionId: string, studentId: string): Promise<StudentAttemptRow[]> {
  const rows = await getDb()
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      studentName: attemptStudentName,
      taskId: attempts.taskId,
      taskTitle: tasks.title,
      taskVersion: attempts.taskVersion,
      passed: attempts.passed,
      hintsUsed: attempts.hintsUsed,
      durationMs: attempts.durationMs,
      score: attempts.score,
      flags: attempts.flags,
      submittedAnswer: attempts.submittedAnswer,
      deviceId: attempts.deviceId,
      voidedAt: attempts.voidedAt,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.studentId, studentId)))
    .orderBy(desc(attempts.createdAt));
  return rows.map(({ flags, score, voidedAt, ...row }) => ({
    ...row,
    score: score === null ? null : Number(score),
    sourceHash: typeof flags?.sourceHash === 'string' ? flags.sourceHash : null,
    activity: parseActivity(flags?.activity),
    voidedAt: voidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  }));
}

/**
 * Every file-delivery attempt in a session, with its source — for the
 * teacher's bulk download. A file-delivery attempt is exactly one that
 * carries `flags.sourceHash` (`POST /api/attempts` sets it from the task).
 */
export async function listFileSubmissionsForSession(sessionId: string): Promise<FileSubmissionRow[]> {
  const rows = await getDb()
    .select({
      studentId: attempts.studentId,
      studentName: attemptStudentName,
      taskId: attempts.taskId,
      taskTitle: tasks.title,
      submittedAnswer: attempts.submittedAnswer,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(
      and(
        eq(attempts.sessionId, sessionId),
        isNull(attempts.voidedAt),
        sql`${attempts.flags} ->> 'sourceHash' is not null`
      )
    );
  return rows.flatMap(({ submittedAnswer, createdAt, ...row }) => {
    const code = submittedAnswer?.code;
    return typeof code === 'string' ? [{ ...row, code, createdAt: createdAt.toISOString() }] : [];
  });
}

/** What the route adds to an attempt beyond the body: derived server-side, never taken from the client as is. */
export interface AttemptExtras {
  /** File-delivery tasks only. */
  sourceHash?: string | null;
  deviceId?: string | null;
  /** Homework only, parsed from the body (lib/task/activity.ts). */
  activity?: EditorActivity | null;
}

/**
 * `student`: the roster entry the route resolved — its name is stored as the
 * name at the time, and the variant seed the task was served under
 * (`deriveSeed` with the student's seed key) is stored beside it, so a later
 * re-check rebuilds the same variant whatever happens to the roster.
 */
export async function recordAttempt(
  input: AttemptInput,
  student: { id: string; name: string; seed: number },
  { sourceHash = null, deviceId = null, activity = null }: AttemptExtras = {},
  db: Executor = getDb()
): Promise<{ id: string }> {
  const flags = {
    ...(sourceHash !== null ? { sourceHash } : {}),
    ...(activity !== null ? { activity } : {})
  };
  const [row] = await db
    .insert(attempts)
    .values({
      sessionId: input.sessionId,
      studentId: student.id,
      studentName: student.name,
      seed: BigInt(student.seed),
      taskId: input.taskId,
      taskVersion: input.taskVersion,
      submittedAnswer: input.submittedAnswer,
      passed: input.passed,
      // A pass is a pass, whatever a client claims about its cases.
      score: input.score === undefined ? null : String(input.passed ? 1 : input.score),
      hintsUsed: input.hintsUsed,
      durationMs: input.durationMs,
      flags: Object.keys(flags).length > 0 ? flags : null,
      deviceId
    })
    .returning({ id: attempts.id });
  return row;
}

export interface PassedAnswerRow {
  id: string;
  studentId: string;
  studentName: string;
  /** The name stored on the attempt: the seed key of attempts from before seeds were stored. */
  studentNameThen: string;
  /** The variant seed the attempt was made under (lib/seed/); null on attempts from before it was stored. */
  seed: number | null;
  taskId: string;
  taskTitle: string;
  taskVersion: number;
  submittedAnswer: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Every passed attempt in a session that still counts, with what was
 * submitted — for the teacher's re-check (lib/task/recheck.ts). Oldest first.
 */
export async function listPassedAnswers(sessionId: string): Promise<PassedAnswerRow[]> {
  const rows = await getDb()
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      studentName: attemptStudentName,
      studentNameThen: attempts.studentName,
      seed: attempts.seed,
      taskId: attempts.taskId,
      taskTitle: tasks.title,
      taskVersion: attempts.taskVersion,
      submittedAnswer: attempts.submittedAnswer,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.passed, true), isNull(attempts.voidedAt)))
    .orderBy(asc(attempts.createdAt));
  return rows.map(({ seed, ...row }) => ({
    ...row,
    seed: seed === null ? null : Number(seed),
    createdAt: row.createdAt.toISOString()
  }));
}

/**
 * Every attempt in a session that still counts, with its program (when it
 * has one) and its paste/edit counts — what a homework's facts are read from
 * (lib/homework/facts.ts). Oldest first.
 */
export async function listFactAttempts(sessionId: string): Promise<FactAttempt[]> {
  const rows = await getDb()
    .select({
      studentId: attempts.studentId,
      studentName: attemptStudentName,
      taskId: attempts.taskId,
      taskTitle: tasks.title,
      passed: attempts.passed,
      submittedAnswer: attempts.submittedAnswer,
      flags: attempts.flags,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(and(eq(attempts.sessionId, sessionId), isNull(attempts.voidedAt)))
    .orderBy(asc(attempts.createdAt));
  return rows.map(({ submittedAnswer, flags, createdAt, ...row }) => ({
    ...row,
    code: typeof submittedAnswer?.code === 'string' ? submittedAnswer.code : null,
    activity: parseActivity(flags?.activity),
    createdAt: createdAt.toISOString()
  }));
}
