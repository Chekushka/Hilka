/**
 * Bulk import of a JSON export — restore a backup or accept a handoff from
 * another teacher (docs/TASKS.md, "JSON export/import of all tasks").
 * Upserts every topic and task by slug; nothing is written if any part of
 * the bundle is invalid (lib/db/content-io.ts).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import type { Check } from '@/lib/checker';
import { ImportValidationError, importContent, type ContentBundle, type TaskContent, type TopicContent } from '@/lib/db/content-io';
import type { RunCase } from '@/lib/task/types';
import { isTaskPayload } from '@/lib/task/payload-guards';

const TASK_STATUSES = ['draft', 'published', 'archived'];

function isCheckShaped(value: unknown): value is Check {
  return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}

function isRunCaseShaped(value: unknown): value is RunCase {
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

function isTopicContentShaped(value: unknown): value is TopicContent {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.slug === 'string' &&
    t.slug.length > 0 &&
    typeof t.title === 'string' &&
    typeof t.order === 'number' &&
    Array.isArray(t.gradeTags) &&
    t.gradeTags.every((g) => typeof g === 'number') &&
    (t.curriculumRef === undefined || typeof t.curriculumRef === 'string') &&
    (t.theoryMd === undefined || typeof t.theoryMd === 'string')
  );
}

function isTaskContentShaped(value: unknown): value is TaskContent {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.slug === 'string' &&
    t.slug.length > 0 &&
    typeof t.topicSlug === 'string' &&
    t.topicSlug.length > 0 &&
    typeof t.type === 'string' &&
    typeof t.title === 'string' &&
    isTaskPayload(t.payload) &&
    Array.isArray(t.checks) &&
    t.checks.every(isCheckShaped) &&
    (t.cases === undefined || (Array.isArray(t.cases) && t.cases.every(isRunCaseShaped))) &&
    Array.isArray(t.hints) &&
    t.hints.every((h) => typeof h === 'string') &&
    typeof t.difficulty === 'number' &&
    Array.isArray(t.gradeTags) &&
    t.gradeTags.every((g) => typeof g === 'number') &&
    typeof t.version === 'number' &&
    typeof t.status === 'string' &&
    TASK_STATUSES.includes(t.status)
  );
}

function isValidBundle(body: unknown): body is ContentBundle {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.topics) &&
    b.topics.every(isTopicContentShaped) &&
    Array.isArray(b.tasks) &&
    b.tasks.every(isTaskContentShaped)
  );
}

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBundle(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const result = await importContent(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ImportValidationError) {
      return NextResponse.json({ error: 'invalid_content', issues: error.issues }, { status: 400 });
    }
    throw error;
  }
}
