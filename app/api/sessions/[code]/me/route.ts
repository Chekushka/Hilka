/**
 * What the room restores on entry (docs/HOMEWORK.md, section 3): the student's
 * own attempts in this session, so done marks, locked tasks and fixes left
 * survive a reload, another tab, another device and another day. Answers only
 * pass/fail and when — never what anyone submitted.
 *
 * `?student=` is the roster id the name screen picked. There is no secret behind a roster
 * name (option D: entry stays free), so anyone with the code could read this
 * for any student — exactly what they would see by picking that name in the room. What makes misuse visible is the
 * device mark, which this route also sets on first visit.
 */
import { NextResponse } from 'next/server';
import { findStudent } from '@/lib/classes/roster';
import { getOpenSessionByCode, listOwnAttempts } from '@/lib/db/sessions';
import { usedElsewhere } from '@/lib/homework/devices';
import { deviceId } from '@/lib/session/device-cookie';
import type { OwnSessionState } from '@/lib/session/types';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ref = new URL(request.url).searchParams.get('student');
  const session = await getOpenSessionByCode(code);
  if (!session) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const student = findStudent(session.roster, ref);
  if (!student) {
    return NextResponse.json({ error: 'unknown_student' }, { status: 400 });
  }

  const device = await deviceId();
  const rows = await listOwnAttempts(session.id, student.id);
  const state: OwnSessionState = {
    attempts: rows.map(({ taskId, passed, score, hintsUsed, createdAt }) => ({
      taskId,
      passed,
      score,
      hintsUsed,
      createdAt
    })),
    usedElsewhere: usedElsewhere(rows, device)
  };
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
