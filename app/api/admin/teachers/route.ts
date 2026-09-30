/**
 * The superuser adds a teacher's address directly — active at once, whether
 * it was unknown, pending or disabled. Superuser only.
 */
import { NextResponse } from 'next/server';
import { isSuperuser } from '@/lib/auth/current-admin';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { addActiveTeacher } from '@/lib/db/teachers';

export async function POST(request: Request) {
  if (!(await isSuperuser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : undefined;
  const email = typeof raw === 'string' ? normalizeEmail(raw) : '';
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  const teacher = await addActiveTeacher(email);
  return NextResponse.json(teacher, { status: 201 });
}
