/**
 * Session creation — the session builder (docs/TASKS.md, "Session builder").
 * Teacher-only, and scoped to a class the caller actually owns; unlike task
 * content (shared curriculum, any teacher may author it), a class and its
 * sessions belong to one teacher.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getClassForTeacher } from '@/lib/db/classes';
import { createSession, filterToPublishedTaskIds } from '@/lib/db/session-authoring';
import type { SessionKind, SessionMode } from '@/lib/session/types';

interface CreateSessionBody {
  classId: string;
  mode: SessionMode;
  /** Absent from older clients: a lesson. */
  kind?: SessionKind;
  taskIds: string[];
  timeLimitS: number | null;
  hintsEnabled: boolean;
  shuffle: boolean;
  /** Homework: ISO deadline, required. */
  dueAt?: string | null;
  /** Homework: tasks offered once a point is lost. */
  improvementTaskIds?: string[];
}

function isValidBody(body: unknown): body is CreateSessionBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.classId === 'string' &&
    b.classId.length > 0 &&
    (b.mode === 'practice' || b.mode === 'graded') &&
    Array.isArray(b.taskIds) &&
    b.taskIds.every((id) => typeof id === 'string') &&
    (b.timeLimitS === null || (typeof b.timeLimitS === 'number' && b.timeLimitS > 0)) &&
    typeof b.hintsEnabled === 'boolean' &&
    typeof b.shuffle === 'boolean' &&
    (b.kind === undefined || b.kind === 'lesson' || b.kind === 'homework') &&
    (b.dueAt === undefined || b.dueAt === null || (typeof b.dueAt === 'string' && !Number.isNaN(Date.parse(b.dueAt)))) &&
    (b.improvementTaskIds === undefined ||
      (Array.isArray(b.improvementTaskIds) && b.improvementTaskIds.every((id) => typeof id === 'string')))
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

  const klass = await getClassForTeacher(body.classId, teacher.id);
  if (!klass) {
    return NextResponse.json({ error: 'unknown_class' }, { status: 400 });
  }

  // The request body is untrusted (CLAUDE.md, "Cheating and Trust") — a task
  // id that is not actually published (deleted, unpublished, typo'd) is
  // silently dropped rather than stored and breaking the join flow later.
  const taskIds = await filterToPublishedTaskIds(body.taskIds);
  if (taskIds.length === 0) {
    return NextResponse.json({ error: 'no_tasks' }, { status: 400 });
  }

  // Homework is always graded, has a deadline and no exam clock (docs/HOMEWORK.md);
  // an improvement task is never also a main task.
  const homework = body.kind === 'homework';
  if (homework && !body.dueAt) {
    return NextResponse.json({ error: 'no_deadline' }, { status: 400 });
  }
  const improvementTaskIds = homework
    ? (await filterToPublishedTaskIds(body.improvementTaskIds ?? [])).filter((id) => !taskIds.includes(id))
    : [];

  const { id, code } = await createSession({
    classId: body.classId,
    mode: homework ? 'graded' : body.mode,
    kind: homework ? 'homework' : 'lesson',
    taskIds,
    improvementTaskIds,
    timeLimitS: homework ? null : body.timeLimitS,
    hintsEnabled: body.hintsEnabled,
    shuffle: body.shuffle,
    dueAt: homework && body.dueAt ? new Date(body.dueAt) : null
  });
  return NextResponse.json({ id, code }, { status: 201 });
}
