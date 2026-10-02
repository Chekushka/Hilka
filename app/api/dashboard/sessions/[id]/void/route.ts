/**
 * Cancels the attempts one device made under one student's name
 * (docs/HOMEWORK.md, section 2): someone else worked as them. The tries those
 * attempts used are free again. Owner-scoped.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { voidDeviceAttempts } from '@/lib/db/sessions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.studentName !== 'string' || typeof b.deviceId !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id } = await params;
  const voided = await voidDeviceAttempts(id, teacher.id, b.studentName, b.deviceId);
  if (voided === null) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ voided });
}
