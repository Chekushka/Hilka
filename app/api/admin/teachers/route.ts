/**
 * The superuser adds a teacher's address directly — active at once, whether
 * it was unknown, pending or disabled — and the teacher is told, unless
 * they already had access. Superuser only.
 */
import { NextResponse } from 'next/server';
import { buildAccessGrantedEmail } from '@/lib/auth/access-email';
import { isSuperuser } from '@/lib/auth/current-admin';
import { deliverInBackground } from '@/lib/auth/deliver-email';
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email';
import { addActiveTeacher, getTeacherByEmail } from '@/lib/db/teachers';

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
  const before = await getTeacherByEmail(email);
  const teacher = await addActiveTeacher(email);
  if (before?.status !== 'active') {
    deliverInBackground(teacher.email, buildAccessGrantedEmail(new URL('/login', request.url).toString()), 'access granted');
  }
  return NextResponse.json(teacher, { status: 201 });
}
