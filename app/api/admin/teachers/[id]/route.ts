/**
 * Approve, disable or re-enable a teacher (PATCH), or reject a pending
 * request (DELETE). Superuser only. A teacher with classes is never deleted,
 * only disabled — their sessions and students' attempts stay readable.
 * Gaining access (approved or re-enabled) emails the teacher; losing it,
 * or being rejected, sends nothing.
 */
import { NextResponse } from 'next/server';
import { buildAccessGrantedEmail } from '@/lib/auth/access-email';
import { isSuperuser } from '@/lib/auth/current-admin';
import { deliverInBackground } from '@/lib/auth/deliver-email';
import { deletePendingTeacher, getTeacherById, setTeacherStatus } from '@/lib/db/teachers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperuser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const status = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).status : undefined;
  // Back to pending is not a thing a superuser does: approve or disable.
  if (!UUID.test(id) || (status !== 'active' && status !== 'disabled')) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const before = await getTeacherById(id);
  const teacher = await setTeacherStatus(id, status);
  if (!teacher) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (status === 'active' && before?.status !== 'active') {
    deliverInBackground(teacher.email, buildAccessGrantedEmail(new URL('/login', request.url).toString()), 'access granted');
  }
  return NextResponse.json(teacher);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperuser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id) || !(await deletePendingTeacher(id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
