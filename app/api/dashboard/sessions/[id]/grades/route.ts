/**
 * Suggested grades for a graded session, one row per student (docs/AI_CONTEXT.md,
 * "Grading"), as CSV for the journal. Owner-scoped like the attempts export.
 * A practice session has no grades, so it 404s the same way an unknown one does.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { gradesToCsv } from '@/lib/dashboard/csv';
import { suggestGradesForRoster } from '@/lib/grading/grade';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session || session.mode !== 'graded') {
    return NextResponse.json({ error: 'unknown_session' }, { status: 404 });
  }

  const grades = suggestGradesForRoster(session.roster, session.tasks, await listAttemptsForSession(session.id));

  return new NextResponse(gradesToCsv(grades), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${session.code}-grades.csv"`
    }
  });
}
