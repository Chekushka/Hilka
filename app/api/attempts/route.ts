/**
 * Records one attempt. Route handler, per CLAUDE.md rule 4 — the only place
 * outside a server component allowed to touch the database.
 *
 * This is telemetry for the append-only attempts table, not the source of
 * truth for whether the student passed: `lib/checker/` already judged that in
 * the browser before this request is ever sent (see ResultPanel), so a client
 * that never reaches this endpoint has still seen correct, immediate feedback.
 * Grading trust is a v1 limitation (docs/AI_CONTEXT.md — "Cheating and
 * Trust"), not something this route is meant to fix.
 *
 * Re-validates against the server's own copy of the session rather than
 * trusting the client: the session the student joined may have closed since,
 * and studentName/taskId are checked against it rather than accepted as-is.
 */
import { NextResponse } from 'next/server';
import { getOpenSessionById, recordAttempt } from '@/lib/db/sessions';

interface AttemptBody {
  sessionId: string;
  studentName: string;
  taskId: string;
  taskVersion: number;
  code: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
}

function isAttemptBody(value: unknown): value is AttemptBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.sessionId === 'string' &&
    typeof body.studentName === 'string' &&
    typeof body.taskId === 'string' &&
    typeof body.taskVersion === 'number' &&
    typeof body.code === 'string' &&
    typeof body.passed === 'boolean' &&
    typeof body.hintsUsed === 'number' &&
    typeof body.durationMs === 'number'
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!isAttemptBody(body)) {
    return NextResponse.json({ error: 'missing or malformed fields' }, { status: 400 });
  }

  const session = await getOpenSessionById(body.sessionId);
  if (!session) {
    // Closed since the page loaded, or never existed. Either way there is
    // nothing left to attach the attempt to.
    return NextResponse.json({ error: 'session is not open' }, { status: 409 });
  }
  if (!session.roster.includes(body.studentName)) {
    return NextResponse.json({ error: 'student is not on this session\'s roster' }, { status: 403 });
  }
  const task = session.tasks.find((candidate) => candidate.id === body.taskId);
  if (!task) {
    return NextResponse.json({ error: 'task is not part of this session' }, { status: 403 });
  }

  await recordAttempt({
    sessionId: session.id,
    studentName: body.studentName,
    taskId: task.id,
    // The version actually shown, not whatever the client claims — a
    // republish between page load and submit must not be spoofable either way.
    taskVersion: task.version,
    code: body.code,
    passed: body.passed,
    hintsUsed: Math.max(0, Math.floor(body.hintsUsed)),
    durationMs: Math.max(0, Math.floor(body.durationMs))
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
