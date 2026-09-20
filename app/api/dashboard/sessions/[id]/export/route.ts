/**
 * CSV export of a session's attempts (docs/TASKS.md, "CSV export"). Scoped
 * to the owning teacher — same ownership check the dashboard page itself
 * uses (lib/db/sessions.ts's getSessionForTeacher) — so this cannot be used
 * to read another teacher's results by guessing a session id.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { attemptsToCsv } from '@/lib/dashboard/csv';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session) {
    return NextResponse.json({ error: 'unknown_session' }, { status: 404 });
  }

  const rows = await listAttemptsForSession(session.id);
  const csv = attemptsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${session.code}.csv"`
    }
  });
}
