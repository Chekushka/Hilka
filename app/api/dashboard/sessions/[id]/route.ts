/**
 * A teacher's actions on their own session: close it (its code stops working),
 * or move a homework's deadline (docs/HOMEWORK.md, section 1). Owner-scoped
 * like every dashboard route — another teacher's session reads as not found.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { closeSession, setSessionDueAt } from '@/lib/db/sessions';

type Body = { action: 'close' } | { action: 'due'; dueAt: string };

function parse(body: unknown): Body | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.action === 'close') return { action: 'close' };
  if (b.action === 'due' && typeof b.dueAt === 'string' && !Number.isNaN(Date.parse(b.dueAt))) {
    return { action: 'due', dueAt: b.dueAt };
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
      : await setSessionDueAt(id, teacher.id, new Date(body.dueAt));
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not_found' }, { status: 404 });
}
