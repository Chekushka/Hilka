/**
 * Bulk download of a session's submitted files (docs/TASKS.md, "File
 * Delivery") as one ZIP: each student's latest upload per file-delivery task
 * (lib/dashboard/submitted-files.ts). Scoped to the owning teacher exactly
 * like the CSV export next door.
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listFileSubmissionsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import { latestSubmissionFiles } from '@/lib/dashboard/submitted-files';
import { createZip } from '@/lib/dashboard/zip';

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

  const zip = createZip(latestSubmissionFiles(await listFileSubmissionsForSession(session.id)));

  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${session.code}-files.zip"`
    }
  });
}
