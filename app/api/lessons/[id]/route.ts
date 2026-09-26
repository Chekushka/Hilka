/**
 * Lesson edit and removal (docs/TASKS.md, "Teacher-side lesson authoring").
 * Unlike a task, a lesson has no draft/publish cycle: it holds no content a
 * student answers, only an explanation and an order of tasks, and every
 * reader already skips unpublished tasks — so a save is live at once.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { deleteLesson, listExistingLessons, listTaskIds, updateLesson } from '@/lib/db/lesson-authoring';
import { isUniqueViolation } from '@/lib/db/task-authoring';
import { isLessonDraftShaped, isUuid, normalizeLessonDraft, validateLessonDraft } from '@/lib/lessons/authoring';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isLessonDraftShaped(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const draft = normalizeLessonDraft(body);
  const errors = validateLessonDraft(draft, {
    lessons: await listExistingLessons(),
    knownTaskIds: await listTaskIds(),
    editingId: id
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_lesson', errors }, { status: 400 });
  }

  try {
    const found = await updateLesson(id, draft);
    return found ? NextResponse.json({ id }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'invalid_lesson', errors: ['slugTaken'] }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id) || !(await deleteLesson(id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
