/**
 * Class creation (docs/TASKS.md, "Class + roster management"). Teacher-only,
 * and owned per-teacher — unlike task content, a class belongs to the
 * teacher who created it (lib/db/classes.ts).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { parseClassBody } from '@/lib/classes/body';
import { createClass } from '@/lib/db/classes';

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = parseClassBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id } = await createClass(teacher.id, body);
  return NextResponse.json({ id }, { status: 201 });
}
