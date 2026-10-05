/**
 * Class edit and deletion (docs/TASKS.md, "Class + roster management").
 * Scoped to the owning teacher, same rule as session creation — a teacher
 * must not be able to rename, re-roster or delete a class it does not own.
 * An edit may carry renames, which move a student's results to the new
 * spelling of their name (lib/classes/roster.ts, `cleanRenames`).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { parseClassBody } from '@/lib/classes/body';
import { cleanRenames } from '@/lib/classes/roster';
import { deleteClass, getClassWithRosterForTeacher, updateClass } from '@/lib/db/classes';
import { isUuid } from '@/lib/lessons/authoring';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = parseClassBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id } = await params;
  const current = isUuid(id) ? await getClassWithRosterForTeacher(id, teacher.id) : null;
  if (!current) {
    return NextResponse.json({ error: 'unknown_class' }, { status: 404 });
  }
  const renames = cleanRenames(body.renames, current.roster, body.roster);
  if (!renames) {
    return NextResponse.json({ error: 'invalid_renames' }, { status: 400 });
  }

  const updated = await updateClass(id, teacher.id, body, renames);
  if (!updated) {
    return NextResponse.json({ error: 'unknown_class' }, { status: 404 });
  }
  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id) || !(await deleteClass(id, teacher.id))) {
    return NextResponse.json({ error: 'unknown_class' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
