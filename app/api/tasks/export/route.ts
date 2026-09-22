/**
 * Full JSON export of every topic and task — backup, git history, handoff
 * to another teacher (docs/TASKS.md, "JSON export/import of all tasks").
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { exportContent } from '@/lib/db/content-io';

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const bundle = await exportContent();
  return NextResponse.json(bundle, {
    headers: { 'Content-Disposition': 'attachment; filename="hilka-tasks.json"' }
  });
}
