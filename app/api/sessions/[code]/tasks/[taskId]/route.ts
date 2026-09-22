/**
 * One task inside a session, by id. The join screen only has task
 * summaries (id, slug, title) — this hands the client the full task once a
 * student opens one, the same shape /practice already sends. CLAUDE.md rule
 * 4: a route handler, never a client component, does the query.
 *
 * A `code` task with `params` (docs/TASK_SCHEMA.md, "Parameterization") is
 * resolved to one concrete variant here, server-side, before the response
 * ever reaches a browser — `seed = hash(sessionId + studentName + taskId)`
 * (docs/AI_CONTEXT.md, "Cheating and Trust"), so the same student always
 * gets the same variant and a teacher's report reproduces it exactly.
 * `?student=` is the same name the join screen already picked from the
 * roster; unparameterized tasks (no `params`) are unaffected either way.
 */
import { NextResponse } from 'next/server';
import { getOpenSessionByCode } from '@/lib/db/sessions';
import { getPublishedTaskById } from '@/lib/db/tasks';
import { resolveTaskParams } from '@/lib/task/params';
import { deriveSeed } from '@/lib/seed';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; taskId: string }> }
) {
  const { code, taskId } = await params;
  const studentName = new URL(request.url).searchParams.get('student');

  // The task must belong to this open session — not just exist and be
  // published — so a student cannot reach tasks outside what was assigned.
  const session = await getOpenSessionByCode(code);
  if (!session || !session.tasks.some((task) => task.id === taskId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const task = await getPublishedTaskById(taskId);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (task.type === 'code' && task.params) {
    // The request is untrusted (CLAUDE.md, "Cheating and Trust") — the same
    // roster check /api/attempts already makes, so a name outside the class
    // cannot fish for a different variant.
    if (!studentName || !session.roster.includes(studentName)) {
      return NextResponse.json({ error: 'unknown_student' }, { status: 400 });
    }
    const seed = deriveSeed(session.id, studentName, task.id);
    return NextResponse.json(resolveTaskParams(task, seed));
  }

  return NextResponse.json(task);
}
