/**
 * Class creation (docs/TASKS.md, "Class + roster management"). Teacher-only,
 * and owned per-teacher — unlike task content, a class belongs to the
 * teacher who created it (lib/db/classes.ts).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { createClass } from '@/lib/db/classes';

interface CreateClassBody {
  title: string;
  roster: string[];
}

function isValidBody(body: unknown): body is CreateClassBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.title === 'string' &&
    b.title.trim().length > 0 &&
    Array.isArray(b.roster) &&
    b.roster.every((name) => typeof name === 'string' && name.trim().length > 0)
  );
}

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id } = await createClass(teacher.id, body.title.trim(), body.roster);
  return NextResponse.json({ id }, { status: 201 });
}
