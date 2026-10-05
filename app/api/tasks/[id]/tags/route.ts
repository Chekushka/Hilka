/**
 * A task's tags (lib/task/tags.ts), on a draft or a published task alike.
 * Teacher-only, like every task write. Tags are what a teacher chooses a task
 * by, not what a student answers, so changing them is not an edit of the task:
 * no draft, no publish gate, no new version (lib/db/task-authoring.ts,
 * `setTaskTags`).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { setTaskTags } from '@/lib/db/task-authoring';
import { isTaskTag, normalizeTags } from '@/lib/task/tags';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const tags = typeof body === 'object' && body !== null ? (body as { tags?: unknown }).tags : undefined;
  // An unknown tag is a client bug, not something to drop silently.
  if (!Array.isArray(tags) || !tags.every(isTaskTag)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const normalized = normalizeTags(tags);
  if (!(await setTaskTags(id, normalized))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ tags: normalized });
}
