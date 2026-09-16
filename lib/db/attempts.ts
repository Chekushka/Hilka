/**
 * Attempts are append-only (docs/AI_CONTEXT.md) — a retry is a new row, and
 * "best attempt" is a query, not an update. Grading (score, flags,
 * parameterized seeds) is future work; this records the signal that exists
 * today.
 */
import { asc, desc, eq } from 'drizzle-orm';
import type { AttemptInput } from '@/lib/session/types';
import { attempts, tasks } from './schema';
import { getDb } from './client';

export interface SessionAttemptRow {
  id: string;
  studentName: string;
  taskTitle: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number | null;
  createdAt: string;
}

/** Every attempt in a session, task title joined in — newest first per student. */
export async function listAttemptsForSession(sessionId: string): Promise<SessionAttemptRow[]> {
  const rows = await getDb()
    .select({
      id: attempts.id,
      studentName: attempts.studentName,
      taskTitle: tasks.title,
      passed: attempts.passed,
      hintsUsed: attempts.hintsUsed,
      durationMs: attempts.durationMs,
      createdAt: attempts.createdAt
    })
    .from(attempts)
    .innerJoin(tasks, eq(attempts.taskId, tasks.id))
    .where(eq(attempts.sessionId, sessionId))
    .orderBy(asc(attempts.studentName), desc(attempts.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function recordAttempt(input: AttemptInput): Promise<{ id: string }> {
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
      durationMs: input.durationMs
    })
    .returning({ id: attempts.id });
  return row;
}
