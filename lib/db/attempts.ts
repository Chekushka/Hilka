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
import { attempts, tasks } from './schema';
import { getDb, type Executor } from './client';

export interface SessionAttemptRow {
  id: string;
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
      studentName: attempts.studentName,
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
    .orderBy(asc(attempts.studentName), desc(attempts.createdAt));
  return rows.map(({ flags, score, ...row }) => ({
    ...row,
    score: score === null ? null : Number(score),
    sourceHash: typeof flags?.sourceHash === 'string' ? flags.sourceHash : null,
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
export async function listAttemptsForStudent(sessionId: string, studentName: string): Promise<StudentAttemptRow[]> {
  const rows = await getDb()
    .select({
      id: attempts.id,
      studentName: attempts.studentName,
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
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.studentName, studentName)))
    .orderBy(desc(attempts.createdAt));
  return rows.map(({ flags, score, voidedAt, ...row }) => ({
    ...row,
    score: score === null ? null : Number(score),
    sourceHash: typeof flags?.sourceHash === 'string' ? flags.sourceHash : null,
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
      studentName: attempts.studentName,
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

export async function recordAttempt(
  input: AttemptInput,
  sourceHash: string | null = null,
  deviceId: string | null = null,
  db: Executor = getDb()
): Promise<{ id: string }> {
  const [row] = await db
    .insert(attempts)
    .values({
      sessionId: input.sessionId,
      studentName: input.studentName,
      taskId: input.taskId,
      taskVersion: input.taskVersion,
      submittedAnswer: input.submittedAnswer,
      passed: input.passed,
      // A pass is a pass, whatever a client claims about its cases.
      score: input.score === undefined ? null : String(input.passed ? 1 : input.score),
      hintsUsed: input.hintsUsed,
      durationMs: input.durationMs,
      flags: sourceHash === null ? null : { sourceHash },
      deviceId
    })
    .returning({ id: attempts.id });
  return row;
}
