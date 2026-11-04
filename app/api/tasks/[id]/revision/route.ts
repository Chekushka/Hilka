/**
 * A published task's revision (lib/task/revision.ts). `POST` opens one from
 * the live version; `DELETE` throws it away. Saving goes through
 * `PATCH /api/tasks/[id]` and publishing through `POST
 * /api/tasks/[id]/publish`, exactly as for a draft. Teacher-only, like every
 * task write; any active teacher may edit any task, as with drafts.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { discardRevision, getTaskForAuthoring, startRevision } from '@/lib/db/task-authoring';
import { revisionBlocker, revisionFromRow } from '@/lib/task/revision';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const task = await getTaskForAuthoring(id);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Already open (another tab, a double click): nothing to start, and the
  // page shows the open one — not an error worth surfacing.
  if (task.status === 'published' && task.revision !== null) {
    return NextResponse.json(task);
  }
  const blocker = revisionBlocker(task);
  if (blocker !== null || task.payload === null) {
    return NextResponse.json({ error: blocker ?? 'no_payload' }, { status: 409 });
  }
  const started = await startRevision(id, revisionFromRow({ ...task, payload: task.payload }));
  if (!started) {
    // Opened or archived between the read and the write; the page re-reads.
    const current = await getTaskForAuthoring(id);
    return current?.revision ? NextResponse.json(current) : NextResponse.json({ error: 'not_published' }, { status: 409 });
  }
  return NextResponse.json(started);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const task = await getTaskForAuthoring(id);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Nothing open is already the state asked for.
  await discardRevision(id);
  return NextResponse.json({ ok: true });
}
