/**
 * Class title/roster edit (docs/TASKS.md, "Class + roster management").
 * Scoped to the owning teacher, same rule as session creation — a teacher
 * must not be able to rename or re-roster a class it does not own.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { updateClass } from '@/lib/db/classes';

interface UpdateClassBody {
  title: string;
  roster: string[];
}

function isValidBody(body: unknown): body is UpdateClassBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.title === 'string' &&
    b.title.trim().length > 0 &&
    Array.isArray(b.roster) &&
    b.roster.every((name) => typeof name === 'string' && name.trim().length > 0)
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id } = await params;
  const updated = await updateClass(id, teacher.id, { title: body.title.trim(), roster: body.roster });
  if (!updated) {
    return NextResponse.json({ error: 'unknown_class' }, { status: 404 });
  }
  return NextResponse.json({ id: updated.id });
}
