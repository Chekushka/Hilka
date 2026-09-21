/**
 * "Who is stuck" (docs/TASKS.md, "Results dashboard"): a student × task
 * matrix built from the session's roster, its assigned tasks and its
 * attempts. Pure — no DOM, no database — same split lib/dashboard/csv.ts
 * uses.
 *
 * A cell is 'stuck' only when the student has tried the task and never
 * passed it — not merely "hasn't started", which just means they haven't
 * reached it yet and is not itself a signal anything is wrong.
 */
import type { SessionAttemptRow } from '@/lib/db/attempts';
import type { SessionTaskSummary } from '@/lib/session/types';

export type CellStatus = 'not_started' | 'passed' | 'stuck';

export interface RollupCell {
  status: CellStatus;
  /** Attempts on this task, this student. 0 when not_started. */
  attempts: number;
}

export interface RollupRow {
  studentName: string;
  /** Same order as the `tasks` passed in. */
  cells: RollupCell[];
  stuckCount: number;
}

/** Rows sorted by `stuckCount` descending, then name — the students needing attention float to the top. */
export function buildRollup(
  roster: string[],
  tasks: SessionTaskSummary[],
  attempts: Pick<SessionAttemptRow, 'studentName' | 'taskId' | 'passed'>[]
): RollupRow[] {
  const rows = roster.map((studentName) => {
    const cells = tasks.map((task): RollupCell => {
      const own = attempts.filter((a) => a.studentName === studentName && a.taskId === task.id);
      if (own.length === 0) {
        return { status: 'not_started', attempts: 0 };
      }
      return { status: own.some((a) => a.passed) ? 'passed' : 'stuck', attempts: own.length };
    });
    return {
      studentName,
      cells,
      stuckCount: cells.filter((cell) => cell.status === 'stuck').length
    };
  });

  return rows.sort((a, b) => b.stuckCount - a.stuckCount || a.studentName.localeCompare(b.studentName, 'uk'));
}
