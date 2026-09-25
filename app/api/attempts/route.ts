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
 *
 * For a file-delivery task the source hash is computed here, from the task as
 * the database knows it — never taken from the body — so a client cannot opt
 * its upload out of shared-file flagging (lib/dashboard/shared-files.ts).
 */
import { NextResponse } from 'next/server';
import { hashSource, recordAttempt } from '@/lib/db/attempts';
import { validateAttemptContext } from '@/lib/db/sessions';
import { getPublishedTaskById } from '@/lib/db/tasks';
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
    (b.score === undefined || (typeof b.score === 'number' && b.score >= 0 && b.score <= 1)) &&
    typeof b.hintsUsed === 'number' &&
    typeof b.durationMs === 'number'
  );
}

async function fileSourceHash(body: AttemptInput): Promise<string | null> {
  const code = body.submittedAnswer.code;
  if (typeof code !== 'string') return null;
  const task = await getPublishedTaskById(body.taskId);
  if (!task || (task.type !== 'code' && task.type !== 'fix')) return null;
  return task.payload.delivery === 'file' ? hashSource(code) : null;
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

  const { id } = await recordAttempt(body, await fileSourceHash(body));
  return NextResponse.json({ id }, { status: 201 });
}
