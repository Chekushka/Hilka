/**
 * One task inside a session, by id. The join screen only has task
 * summaries (id, slug, title) — this hands the client the full task once a
 * student opens one, the same shape /practice already sends. CLAUDE.md rule
 * 4: a route handler, never a client component, does the query.
 */
import { NextResponse } from 'next/server';
import { getOpenSessionByCode } from '@/lib/db/sessions';
import { getPublishedCodeTaskById } from '@/lib/db/tasks';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; taskId: string }> }
) {
  const { code, taskId } = await params;

  // The task must belong to this open session — not just exist and be
  // published — so a student cannot reach tasks outside what was assigned.
  const session = await getOpenSessionByCode(code);
  if (!session || !session.tasks.some((task) => task.id === taskId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const task = await getPublishedCodeTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(task);
}
