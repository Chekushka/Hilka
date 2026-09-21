/**
 * Draft task read/edit. A task is only editable here while it is still a
 * draft (docs/TASKS.md, "Draft / publish + version bump") — re-drafting a
 * published task is separate, unbuilt work.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { validateTaskChecks, type Check } from '@/lib/checker';
import { getTaskForAuthoring, updateDraftTask } from '@/lib/db/task-authoring';
import type { RunCase, TaskPayload } from '@/lib/task/types';
import { isTaskPayload } from '@/lib/task/payload-guards';

interface UpdateTaskBody {
  title?: string;
  payload?: TaskPayload;
  checks?: Check[];
  /** `code`/`fix` only. */
  cases?: RunCase[];
  hints?: string[];
  difficulty?: number;
  gradeTags?: number[];
}

function isCheckShaped(value: unknown): value is Check {
  return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}

function isCaseShaped(value: unknown): value is RunCase {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    Array.isArray(c.stdin) &&
    c.stdin.every((line) => typeof line === 'string') &&
    (c.checks === undefined || (Array.isArray(c.checks) && c.checks.every(isCheckShaped))) &&
    (c.label === undefined || typeof c.label === 'string') &&
    (c.hidden === undefined || typeof c.hidden === 'boolean')
  );
}

function isValidBody(body: unknown): body is UpdateTaskBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    (b.title === undefined || (typeof b.title === 'string' && b.title.length > 0)) &&
    (b.payload === undefined || isTaskPayload(b.payload)) &&
    (b.checks === undefined || (Array.isArray(b.checks) && b.checks.every(isCheckShaped))) &&
    (b.cases === undefined || (Array.isArray(b.cases) && b.cases.every(isCaseShaped))) &&
    (b.hints === undefined || (Array.isArray(b.hints) && b.hints.every((h) => typeof h === 'string'))) &&
    (b.difficulty === undefined || typeof b.difficulty === 'number') &&
    (b.gradeTags === undefined || (Array.isArray(b.gradeTags) && b.gradeTags.every((g) => typeof g === 'number')))
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const task = await getTaskForAuthoring(id);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const existing = await getTaskForAuthoring(id);
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'not_editable' }, { status: 409 });
  }

  if (body.checks) {
    const errors = validateTaskChecks(
      { checks: body.checks, cases: body.cases ?? existing.cases ?? undefined, type: body.payload?.type ?? existing.type },
      { requireReference: false }
    );
    if (errors.length > 0) {
      return NextResponse.json({ error: 'invalid_checks', details: errors }, { status: 400 });
    }
  }

  const updated = await updateDraftTask(id, {
    ...body,
    // An explicit empty array clears cases to null (updateDraftTask's own
    // Partial semantics) rather than leaving the previous value in place —
    // that is how a teacher removes every case.
    cases: body.cases === undefined ? undefined : body.cases.length > 0 ? body.cases : null
  });
  if (!updated) {
    // Published between the check above and the write — same report either way.
    return NextResponse.json({ error: 'not_editable' }, { status: 409 });
  }
  return NextResponse.json(updated);
}
