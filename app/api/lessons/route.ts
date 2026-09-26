/**
 * Lesson creation (docs/TASKS.md, "Teacher-side lesson authoring"). Lessons
 * are shared curriculum content like tasks, so any logged-in teacher may
 * author them. Every rule lives in lib/lessons/authoring.ts; this handler
 * only gathers what the rules need from the database.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { createLesson, listExistingLessons, listTaskIds } from '@/lib/db/lesson-authoring';
import { isUniqueViolation } from '@/lib/db/task-authoring';
import { isLessonDraftShaped, normalizeLessonDraft, validateLessonDraft } from '@/lib/lessons/authoring';

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isLessonDraftShaped(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const draft = normalizeLessonDraft(body);
  const errors = validateLessonDraft(draft, { lessons: await listExistingLessons(), knownTaskIds: await listTaskIds() });
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_lesson', errors }, { status: 400 });
  }

  try {
    const { id } = await createLesson(draft);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    // Two teachers saving the same slug at once: the check above passed for both.
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'invalid_lesson', errors: ['slugTaken'] }, { status: 400 });
    }
    throw error;
  }
}
