/**
 * The publish gate (docs/TASK_SCHEMA.md, "Reference solutions"): a task's
 * reference solution must pass its own checks before it can go live.
 *
 * There is no server-side Python execution (docs/AI_CONTEXT.md), so the
 * reference run itself happens in the teacher's browser — the same runner
 * `/practice` already uses — and is posted here already computed. What this
 * route verifies server-side is the part that IS pure and isomorphic: the
 * checker evaluation (lib/checker/reference-check.ts). It does not re-run
 * Python, so it trusts the run's own stdout/drawing/vars — an authenticated
 * teacher is a trusted author, not an adversarial student (CLAUDE.md,
 * "Cheating and Trust").
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { evaluateAgainstOwnRun, type RunOutcome } from '@/lib/checker';
import { getTaskForAuthoring, publishTask } from '@/lib/db/task-authoring';

interface PublishBody {
  referenceCode: string;
  run: RunOutcome;
}

function isValidBody(body: unknown): body is PublishBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.referenceCode !== 'string' || b.referenceCode.length === 0) return false;
  if (typeof b.run !== 'object' || b.run === null) return false;
  const run = b.run as Record<string, unknown>;
  return (
    typeof run.stdout === 'string' &&
    Array.isArray(run.drawing) &&
    typeof run.timedOut === 'boolean' &&
    (run.error === null || typeof run.error === 'object')
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const task = await getTaskForAuthoring(id);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (task.status !== 'draft') {
    return NextResponse.json({ error: 'not_a_draft' }, { status: 409 });
  }

  const outcome = evaluateAgainstOwnRun(body.referenceCode, task.checks, body.run);
  if (!outcome.ranCleanly) {
    return NextResponse.json({ error: 'reference_run_failed', detail: body.run.error }, { status: 422 });
  }
  if (!outcome.passed) {
    return NextResponse.json({ error: 'reference_fails_checks', failures: outcome.failures }, { status: 422 });
  }

  const updated = await publishTask(id, {
    code: body.referenceCode,
    computedAt: new Date().toISOString(),
    artifacts: { stdout: body.run.stdout, drawing: body.run.drawing }
  });
  if (!updated) {
    return NextResponse.json({ error: 'publish_race' }, { status: 409 });
  }
  return NextResponse.json(updated);
}
