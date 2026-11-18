/**
 * The class race's board for the room (lib/game/race.ts): the top names with
 * their points, and — with `?student=` — that student's own points and how far
 * the next place up is. Names only, which the name screen already shows to
 * anyone with the code; never what anyone submitted. 404 unless the session is
 * open and its race is on.
 */
import { NextResponse } from 'next/server';
import { findStudent } from '@/lib/classes/roster';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getOpenSessionByCode } from '@/lib/db/sessions';
import { boardOf, ownStanding, possiblePoints, raceStandings, ROOM_TOP } from '@/lib/game/race';
import type { RaceBoard } from '@/lib/game/types';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getOpenSessionByCode(code);
  if (!session || !session.game) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const student = findStudent(session.roster, new URL(request.url).searchParams.get('student'));
  const standings = raceStandings(session.roster, session.tasks, await listAttemptsForSession(session.id));
  const board: RaceBoard = {
    possible: possiblePoints(session.tasks, session.assignment.poolSize),
    top: boardOf(standings, ROOM_TOP).map(({ studentId, name, points, place }) => ({
      name,
      points,
      place,
      me: studentId === student?.id
    })),
    me: student ? ownStanding(standings, student.id) : null
  };
  return NextResponse.json(board, { headers: { 'Cache-Control': 'no-store' } });
}
