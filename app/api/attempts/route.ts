/**
 * Attempt submission. Attempts are append-only (docs/AI_CONTEXT.md) — every
 * Check the student runs in a session becomes a new row, never an update.
 *
 * The request body is untrusted: a student with devtools can claim anything,
 * including `passed: true` on a task they never solved. That is the accepted,
 * documented trade-off of a client-side checker (CLAUDE.md, "Cheating and
 * Trust") — the fix is a server-side re-check on final submission, not built
 * yet. What this route does enforce is that the row cannot lie about which
 * session, task and roster name it belongs to.
 */
import { NextResponse } from 'next/server';
import { recordAttempt } from '@/lib/db/attempts';
import { validateAttemptContext } from '@/lib/db/sessions';
import type { AttemptInput } from '@/lib/session/types';

function isValidBody(body: unknown): body is AttemptInput {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.sessionId === 'string' &&
    typeof b.studentName === 'string' &&
    typeof b.taskId === 'string' &&
    typeof b.taskVersion === 'number' &&
    typeof b.submittedAnswer === 'object' &&
    b.submittedAnswer !== null &&
    typeof b.passed === 'boolean' &&
    typeof b.hintsUsed === 'number' &&
    typeof b.durationMs === 'number'
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const valid = await validateAttemptContext(body.sessionId, body.taskId, body.studentName);
  if (!valid) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 403 });
  }

  const { id } = await recordAttempt(body);
  return NextResponse.json({ id }, { status: 201 });
}
