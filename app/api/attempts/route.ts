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
 *
 * How many Checks a task allows is decided here too, not only in the room
 * (lib/homework/rules.ts, `canSubmit`): a graded lesson's first Check is final,
 * homework allows two fixes after a failed one, an improvement task one Check
 * once a point is lost. The room alone could be reloaded around. Over the
 * limit, the answer is 409 and nothing is recorded. Each attempt carries this
 * browser's device mark (lib/session/device-cookie.ts).
 */
import { NextResponse } from 'next/server';
import { hashSource, recordAttempt } from '@/lib/db/attempts';
import { getDb } from '@/lib/db/client';
import { getAttemptContext, listOwnAttempts, lockStudentTask } from '@/lib/db/sessions';
import { getPublishedTaskById } from '@/lib/db/tasks';
import { canSubmit } from '@/lib/homework/rules';
import { deviceId } from '@/lib/session/device-cookie';
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

  const context = await getAttemptContext(body.sessionId, body.taskId, body.studentName);
  if (!context) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 403 });
  }

  const device = await deviceId();
  const sourceHash = await fileSourceHash(body);
  const id = await getDb().transaction(async (tx) => {
    await lockStudentTask(tx, body.sessionId, body.studentName, body.taskId);
    const prior = await listOwnAttempts(body.sessionId, body.studentName, tx);
    if (!canSubmit(context.rules, body.taskId, prior)) return null;
    return (await recordAttempt(body, sourceHash, device, tx)).id;
  });
  if (id === null) {
    return NextResponse.json({ error: 'no_checks_left' }, { status: 409 });
  }
  return NextResponse.json({ id }, { status: 201 });
}
