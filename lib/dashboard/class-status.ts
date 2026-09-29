/**
 * Where each student in a session stands — the class table and the student
 * card (docs/design-brief-python-platform.md, "Teacher": who is working, who
 * is stuck, who has finished). Pure, like lib/dashboard/rollup.ts, which it
 * builds on: the per-task cells are the rollup's, the rest is added here.
 *
 * Only attempts exist to go on — a Check is the one thing the server hears
 * about (docs/AI_CONTEXT.md). So "working" means "has checked something and
 * is not finished", and time and hints are read off the attempts themselves:
 * every attempt carries the hints opened and the time since the task was
 * opened, both counted from the moment the task screen mounted
 * (components/task-types/*View.tsx), so a task's latest attempt holds its
 * running total. Reopening a task restarts both counts, so the totals are a
 * floor, never an overstatement.
 */
import type { SessionAttemptRow } from '@/lib/db/attempts';
import type { SessionMode, SessionTaskSummary } from '@/lib/session/types';
import { buildRollup, type RollupCell } from './rollup';

export type StudentState = 'not_started' | 'working' | 'stuck' | 'finished';

/**
 * When a student counts as stuck. Only in a practice-mode session: a graded
 * one allows a single Check per task, so failing it moves the student on
 * rather than keeping them on the task.
 */
export const STUCK_RULES = {
  /** This many Checks on one task without a pass. */
  failedChecks: 3,
  /** Or: the latest Check failed and nothing has been checked since for this long. */
  idleMinutes: 5
} as const;

export type StudentAttempt = Pick<
  SessionAttemptRow,
  'studentName' | 'taskId' | 'passed' | 'hintsUsed' | 'durationMs' | 'createdAt'
>;

export interface StudentSummary {
  studentName: string;
  state: StudentState;
  /** Same order as the session's tasks. */
  cells: RollupCell[];
  /** Passed tasks — in a graded session, tasks checked (each is final there). */
  tasksDone: number;
  tasksTotal: number;
  attempts: number;
  /** Hints opened, summed over tasks. */
  hints: number;
  /** Time on tasks, summed over tasks; a floor (see the file comment). */
  timeSpentMs: number;
  /** ISO time of the latest attempt; null when there is none. */
  lastActivityAt: string | null;
  /** The task the latest attempt was on — where the student is now. */
  currentTaskId: string | null;
}

export interface SessionContext {
  mode: SessionMode;
  /** An open session can go idle; a closed one only has its final state. */
  open: boolean;
  /** Milliseconds since the epoch, passed in so the function stays pure. */
  now: number;
}

/** Hints and time for one task: the latest attempt's counts, which only grow while the task stays open. */
function taskTotals(own: StudentAttempt[]): { hints: number; timeMs: number } {
  return {
    hints: Math.max(0, ...own.map((a) => a.hintsUsed)),
    timeMs: Math.max(0, ...own.map((a) => a.durationMs ?? 0))
  };
}

function newestFirst(a: StudentAttempt, b: StudentAttempt): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function stateOf(
  cells: RollupCell[],
  own: StudentAttempt[],
  tasksDone: number,
  context: SessionContext
): StudentState {
  if (own.length === 0) return 'not_started';
  if (cells.length > 0 && tasksDone === cells.length) return 'finished';
  if (context.mode === 'graded') return 'working';

  if (cells.some((cell) => cell.status === 'stuck' && cell.attempts >= STUCK_RULES.failedChecks)) {
    return 'stuck';
  }
  const latest = own[0];
  const idleMs = context.now - Date.parse(latest.createdAt);
  if (context.open && !latest.passed && idleMs >= STUCK_RULES.idleMinutes * 60_000) {
    return 'stuck';
  }
  return 'working';
}

/**
 * One summary per roster name, in roster order — sorting is the caller's
 * (see `sortForClassTable`). A name with attempts but no longer on the
 * roster is left out, same as the rollup.
 */
export function summarizeStudents(
  roster: string[],
  tasks: SessionTaskSummary[],
  attempts: StudentAttempt[],
  context: SessionContext
): StudentSummary[] {
  const rollup = new Map(buildRollup(roster, tasks, attempts).map((row) => [row.studentName, row.cells]));
  const taskIds = new Set(tasks.map((task) => task.id));

  return roster.map((studentName) => {
    const own = attempts
      .filter((a) => a.studentName === studentName && taskIds.has(a.taskId))
      .sort(newestFirst);
    const cells = rollup.get(studentName) ?? [];
    const tasksDone = cells.filter((cell) =>
      context.mode === 'graded' ? cell.status !== 'not_started' : cell.status === 'passed'
    ).length;

    let hints = 0;
    let timeSpentMs = 0;
    for (const task of tasks) {
      const totals = taskTotals(own.filter((a) => a.taskId === task.id));
      hints += totals.hints;
      timeSpentMs += totals.timeMs;
    }

    return {
      studentName,
      state: stateOf(cells, own, tasksDone, context),
      cells,
      tasksDone,
      tasksTotal: tasks.length,
      attempts: own.length,
      hints,
      timeSpentMs,
      lastActivityAt: own[0]?.createdAt ?? null,
      currentTaskId: own[0]?.taskId ?? null
    };
  });
}

const STATE_ORDER: Record<StudentState, number> = { stuck: 0, working: 1, not_started: 2, finished: 3 };

/**
 * Stuck students first, then the ones working, then the ones yet to start,
 * finished last — the order a teacher walks the room in. Alphabetical inside
 * each group, so a row only moves when its state changes.
 */
export function sortForClassTable(rows: StudentSummary[]): StudentSummary[] {
  return [...rows].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.studentName.localeCompare(b.studentName, 'uk')
  );
}

/** How many students are in each state — the tally above the class table. */
export function countStates(rows: StudentSummary[]): Record<StudentState, number> {
  const counts: Record<StudentState, number> = { not_started: 0, working: 0, stuck: 0, finished: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

/** Hints and time for one task of one student — the student card's per-task line. */
export function taskTotalsFor(attempts: StudentAttempt[], taskId: string): { hints: number; timeMs: number } {
  return taskTotals(attempts.filter((a) => a.taskId === taskId));
}
