/**
 * Attempts are append-only (docs/AI_CONTEXT.md) — a retry is a new row, and
 * "best attempt" is a query, not an update. Grading (score, flags,
 * parameterized seeds) is future work; this records the signal that exists
 * today.
 */
import type { AttemptInput } from '@/lib/session/types';
import { attempts } from './schema';
import { getDb } from './client';

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
