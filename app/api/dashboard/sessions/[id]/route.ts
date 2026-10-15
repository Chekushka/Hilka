/**
 * A teacher's actions on their own session: close it (its code stops working),
 * move a homework's deadline (docs/HOMEWORK.md, section 1), change its routes
 * after it was created (lib/session/routes.ts), or delete it with everything
 * recorded in it. Owner-scoped like every dashboard route — another
 * teacher's session reads as not found.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { filterToPublishedTaskIds } from '@/lib/db/session-authoring';
import { closeSession, deleteSession, getSessionForTeacher, setSessionDueAt, setSessionRoutes } from '@/lib/db/sessions';
import { isUuid } from '@/lib/lessons/authoring';
import { cleanStudentRoutes } from '@/lib/session/routes';

type Body =
  | { action: 'close' }
  | { action: 'due'; dueAt: string }
  | { action: 'routes'; supportTaskIds: string[]; extensionTaskIds: string[]; studentRoutes: unknown };

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

function parse(body: unknown): Body | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.action === 'close') return { action: 'close' };
  if (b.action === 'due' && typeof b.dueAt === 'string' && !Number.isNaN(Date.parse(b.dueAt))) {
    return { action: 'due', dueAt: b.dueAt };
  }
  if (b.action === 'routes' && isIdList(b.supportTaskIds) && isIdList(b.extensionTaskIds)) {
    return { action: 'routes', supportTaskIds: b.supportTaskIds, extensionTaskIds: b.extensionTaskIds, studentRoutes: b.studentRoutes };
  }
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const { id } = await params;
  const done =
    body.action === 'close'
      ? await closeSession(id, teacher.id)
      : body.action === 'due'
        ? await setSessionDueAt(id, teacher.id, new Date(body.dueAt))
        : await saveRoutes(id, teacher.id, body);
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
}

/**
 * The same cleaning as at creation (`POST /api/sessions`): published tasks
 * only, never a main or improvement task nor the other route's, and students
 * on this class's roster on a route that has tasks.
 */
async function saveRoutes(
  sessionId: string,
  teacherId: string,
  body: Extract<Body, { action: 'routes' }>
): Promise<boolean> {
  if (!isUuid(sessionId)) return false;
  const session = await getSessionForTeacher(sessionId, teacherId);
  if (!session || !session.open || session.kind === 'check') return false;
  const taken = new Set([...session.tasks, ...session.improvementTasks].map((task) => task.id));
  const supportTaskIds = (await filterToPublishedTaskIds(body.supportTaskIds)).filter((taskId) => !taken.has(taskId));
  supportTaskIds.forEach((taskId) => taken.add(taskId));
  const extensionTaskIds = (await filterToPublishedTaskIds(body.extensionTaskIds)).filter((taskId) => !taken.has(taskId));
  const studentRoutes = cleanStudentRoutes(body.studentRoutes, new Set(session.roster.map((student) => student.id)), {
    support: supportTaskIds,
    extension: extensionTaskIds
  });
  return setSessionRoutes(sessionId, teacherId, { supportTaskIds, extensionTaskIds, studentRoutes });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const removed = isUuid(id) ? await deleteSession(id, teacher.id) : null;
  return removed === null
    ? NextResponse.json({ error: 'not_found' }, { status: 404 })
    : NextResponse.json({ ok: true, removed });
}
