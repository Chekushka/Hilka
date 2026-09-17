/**
 * Draft task creation. Teacher-only — task content is shared curriculum
 * content, not owned per-teacher, so any logged-in teacher may author it
 * (docs/AI_CONTEXT.md, "Teacher Auth"). Scoped to `code` and `parsons`
 * tasks, the only two types the rest of the app understands end to end
 * (docs/TASKS.md).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { validateTaskChecks, type Check } from '@/lib/checker';
import { createDraftTask, isUniqueViolation } from '@/lib/db/task-authoring';
import { getTopicIdBySlug } from '@/lib/db/topics';
import type { TaskPayload } from '@/lib/task/types';
import { isTaskPayload } from '@/lib/task/payload-guards';

interface CreateTaskBody {
  slug: string;
  topicSlug: string;
  title: string;
  payload: TaskPayload;
  checks: Check[];
  hints?: string[];
  difficulty?: number;
  gradeTags?: number[];
}

// Structural only — a Check's kind decides its shape, and re-deriving the
// full discriminated union at runtime would just duplicate lib/checker/types.ts.
// validateTaskChecks below catches the business rules that matter (e.g.
// stdout_equals with cases); an authenticated teacher is a trusted author,
// not an adversarial student (CLAUDE.md, "Cheating and Trust").
function isCheckShaped(value: unknown): value is Check {
  return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}

function isValidBody(body: unknown): body is CreateTaskBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.slug === 'string' &&
    b.slug.length > 0 &&
    typeof b.topicSlug === 'string' &&
    b.topicSlug.length > 0 &&
    typeof b.title === 'string' &&
    b.title.length > 0 &&
    isTaskPayload(b.payload) &&
    Array.isArray(b.checks) &&
    b.checks.every(isCheckShaped) &&
    (b.hints === undefined || (Array.isArray(b.hints) && b.hints.every((h) => typeof h === 'string'))) &&
    (b.difficulty === undefined || typeof b.difficulty === 'number') &&
    (b.gradeTags === undefined || (Array.isArray(b.gradeTags) && b.gradeTags.every((g) => typeof g === 'number')))
  );
}

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // A draft has no reference solution yet by construction — that arrives at
  // publish time (lib/checker/reference-check.ts's evaluateAgainstOwnRun is
  // the real gate then), so a draft save must not be blocked on it.
  const errors = validateTaskChecks({ checks: body.checks, type: body.payload.type }, { requireReference: false });
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_checks', details: errors }, { status: 400 });
  }

  const topicId = await getTopicIdBySlug(body.topicSlug);
  if (!topicId) {
    return NextResponse.json({ error: 'unknown_topic' }, { status: 400 });
  }

  try {
    const { id } = await createDraftTask({
      slug: body.slug,
      topicId,
      title: body.title,
      payload: body.payload,
      checks: body.checks,
      hints: body.hints ?? [],
      difficulty: body.difficulty ?? 1,
      gradeTags: body.gradeTags ?? []
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
    throw error;
  }
}
