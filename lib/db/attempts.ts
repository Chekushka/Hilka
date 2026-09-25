/**
 * Attempts are append-only (docs/AI_CONTEXT.md) — a retry is a new row, and
 * "best attempt" is a query, not an update. Grading (score, most flags,
 * parameterized seeds) is future work; this records the signal that exists
 * today. The one flag recorded so far is `sourceHash`, on file-delivery
 * attempts only (lib/dashboard/shared-files.ts).
 */
import { createHash } from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import type { AttemptInput } from '@/lib/session/types';
import { attempts, tasks } from './schema';
import { getDb } from './client';

export interface SessionAttemptRow {
  id: string;
  studentName: string;
  taskId: string;
  taskTitle: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number | null;
  /** SHA-256 of the uploaded source; null for anything that was not a file upload. */
  sourceHash: string | null;
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

/** Every attempt in a session, task title joined in — newest first per student. */
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
      flags: attempts.flags,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(eq(attempts.sessionId, sessionId))
    .orderBy(asc(attempts.studentName), desc(attempts.createdAt));
  return rows.map(({ flags, ...row }) => ({
    ...row,
    sourceHash: typeof flags?.sourceHash === 'string' ? flags.sourceHash : null,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function recordAttempt(
  input: AttemptInput,
  sourceHash: string | null = null
): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(attempts)
    .values({
      sessionId: input.sessionId,
      studentName: input.studentName,
      taskId: input.taskId,
      taskVersion: input.taskVersion,
      submittedAnswer: input.submittedAnswer,
      passed: input.passed,
      hintsUsed: input.hintsUsed,
      durationMs: input.durationMs,
      flags: sourceHash === null ? null : { sourceHash }
    })
    .returning({ id: attempts.id });
  return row;
}
