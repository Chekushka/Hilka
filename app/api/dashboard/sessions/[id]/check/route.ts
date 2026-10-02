/**
 * Creates a class check of a homework (docs/HOMEWORK.md, section 4a): a short
 * graded session in class, for the same class, on some of the homework's main
 * tasks. A parameterized task gets each student a new variant on its own,
 * since the seed includes the session. Its results confirm or lower the
 * homework's credit; it has no grade of its own. Owner-scoped.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { createSession } from '@/lib/db/session-authoring';
import { getSessionForTeacher } from '@/lib/db/sessions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const homework = await getSessionForTeacher(id, teacher.id);
  if (!homework || homework.kind !== 'homework') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const requested = Array.isArray(b.taskIds) ? b.taskIds.filter((value): value is string => typeof value === 'string') : [];
  const timeLimitS = b.timeLimitS === null || b.timeLimitS === undefined ? null : Number(b.timeLimitS);
  if (timeLimitS !== null && !(Number.isInteger(timeLimitS) && timeLimitS > 0)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Only the homework's own main tasks, in the homework's order — never something it did not assign.
  const taskIds = homework.tasks.map((task) => task.id).filter((taskId) => requested.includes(taskId));
  if (taskIds.length === 0) {
    return NextResponse.json({ error: 'no_tasks' }, { status: 400 });
  }

  const created = await createSession({
    classId: homework.classId,
    mode: 'graded',
    kind: 'check',
    taskIds,
    improvementTaskIds: [],
    timeLimitS,
    // Off unless asked for: the point is to see what the student can do alone.
    hintsEnabled: b.hintsEnabled === true,
    shuffle: false,
    dueAt: null,
    checksSessionId: homework.id
  });
  return NextResponse.json(created, { status: 201 });
}
