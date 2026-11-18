/**
 * The class race: a mini-game a teacher can switch on for a lesson. Every
 * solved task moves a student along the track, and a leaderboard shows who is
 * ahead — on the projector and in the room's task list, never inside the
 * workspace (docs/design-brief-python-platform.md: the workspace stays calm).
 *
 * Points only ever go up: a failed Check, a hint or a slow start costs nothing
 * — the race rewards solving, not punishes trying. A task is worth 10 per
 * level of difficulty, plus a small bonus when its very first Check passed.
 * Only the session's main tasks count, so a route (lib/session/routes.ts)
 * neither helps nor hurts anyone's place.
 *
 * Pure: the room's API and the projector page both read standings from here.
 * Never part of a grade (lib/grading/ does not read it).
 */

export const POINTS_PER_DIFFICULTY = 10;
export const FIRST_TRY_BONUS = 5;
/** How many names a student sees; the projector shows `PROJECTOR_TOP`. */
export const ROOM_TOP = 5;
export const PROJECTOR_TOP = 10;

export interface RaceTask {
  id: string;
  /** 1..5. */
  difficulty: number;
}

export interface RaceAttempt {
  studentId: string;
  taskId: string;
  passed: boolean;
  /** ISO. */
  createdAt: string;
}

export interface RaceStudent {
  id: string;
  name: string;
}

export interface Standing {
  studentId: string;
  name: string;
  points: number;
  solved: number;
  /** 1-based; students with equal points share a place. */
  place: number;
  /** When the student reached their current points (ISO); null with no points. Earlier ranks higher among equals. */
  reachedAt: string | null;
}

/** What one task is worth when solved, with and without the first-try bonus. */
export function taskPoints(difficulty: number, firstTry: boolean): number {
  const level = Math.min(5, Math.max(1, Math.round(difficulty)));
  return level * POINTS_PER_DIFFICULTY + (firstTry ? FIRST_TRY_BONUS : 0);
}

/** The most points the session's tasks can give one student — the finish line. */
export function possiblePoints(tasks: readonly RaceTask[], poolSize: number | null): number {
  const worth = tasks.map((task) => taskPoints(task.difficulty, true)).sort((a, b) => b - a);
  const counted = poolSize !== null && poolSize > 0 ? worth.slice(0, poolSize) : worth;
  return counted.reduce((sum, value) => sum + value, 0);
}

/** Everyone on the roster, best first. A student with no attempt is there with 0 points. */
export function raceStandings(
  roster: readonly RaceStudent[],
  tasks: readonly RaceTask[],
  attempts: readonly RaceAttempt[]
): Standing[] {
  const difficulty = new Map(tasks.map((task) => [task.id, task.difficulty]));
  const ordered = [...attempts]
    .filter((attempt) => difficulty.has(attempt.taskId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const rows = roster.map((student) => {
    const tried = new Set<string>();
    const solved = new Set<string>();
    let points = 0;
    let reachedAt: string | null = null;
    for (const attempt of ordered) {
      if (attempt.studentId !== student.id || solved.has(attempt.taskId)) continue;
      const firstTry = !tried.has(attempt.taskId);
      tried.add(attempt.taskId);
      if (!attempt.passed) continue;
      solved.add(attempt.taskId);
      points += taskPoints(difficulty.get(attempt.taskId)!, firstTry);
      reachedAt = attempt.createdAt;
    }
    return { studentId: student.id, name: student.name, points, solved: solved.size, reachedAt };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      (a.reachedAt ?? '').localeCompare(b.reachedAt ?? '') ||
      a.name.localeCompare(b.name, 'uk')
  );

  let place = 0;
  let previous: number | null = null;
  return rows.map((row, index) => {
    if (row.points !== previous) {
      place = index + 1;
      previous = row.points;
    }
    return { ...row, place };
  });
}

/** What a student's own race card says: their points, and how far the next place up is. */
export interface OwnStanding {
  points: number;
  solved: number;
  place: number;
  /** Points still needed to reach the next place up; null when nobody is ahead. */
  toNextPlace: number | null;
  /** Whether the student is among the names everyone sees. */
  onBoard: boolean;
}

export function ownStanding(standings: readonly Standing[], studentId: string, top = ROOM_TOP): OwnStanding | null {
  const index = standings.findIndex((row) => row.studentId === studentId);
  if (index < 0) return null;
  const me = standings[index];
  // The nearest score above: equal points share a place, so reaching it is moving up.
  const ahead = standings
    .slice(0, index)
    .reverse()
    .find((row) => row.points > me.points);
  return {
    points: me.points,
    solved: me.solved,
    place: me.place,
    toNextPlace: ahead ? ahead.points - me.points : null,
    onBoard: index < top && me.points > 0
  };
}

/**
 * The names on the board: the top `top`, and only students who have scored —
 * nobody is shown on a leaderboard at zero.
 */
export function boardOf(standings: readonly Standing[], top: number): Standing[] {
  return standings.filter((row) => row.points > 0).slice(0, top);
}
