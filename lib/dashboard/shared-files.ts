/**
 * Identical uploaded files across students (docs/AI_CONTEXT.md, "Cheating and
 * Trust", point 4). A file is easier to pass around than typed code, so every
 * file-delivery attempt carries a hash of its source (`flags.sourceHash`,
 * computed server-side by `POST /api/attempts`), and this groups them.
 *
 * Pure — no DOM, no database — same split as rollup.ts and csv.ts.
 *
 * Only passing attempts count. An untouched starter file is identical for
 * every student who uploads it too early, and it fails; flagging that would
 * put noise in front of the teacher and say nothing about sharing. What a
 * shared file actually buys is a pass, so that is what is surfaced.
 *
 * This surfaces a fact, never an accusation — for a short task, identical
 * correct solutions are expected. The teacher decides.
 */
import type { SessionAttemptRow } from '@/lib/db/attempts';

export interface SharedFileGroup {
  taskId: string;
  taskTitle: string;
  /** Distinct, sorted. Always two or more. */
  studentNames: string[];
}

/** Groups sorted by task title, then by the first student name — stable across refreshes. */
export function findSharedFiles(
  attempts: Pick<SessionAttemptRow, 'studentName' | 'taskId' | 'taskTitle' | 'passed' | 'sourceHash'>[]
): SharedFileGroup[] {
  const groups = new Map<string, { taskId: string; taskTitle: string; students: Set<string> }>();
  for (const attempt of attempts) {
    if (!attempt.passed || attempt.sourceHash === null) continue;
    const key = `${attempt.taskId}\u0000${attempt.sourceHash}`;
    let group = groups.get(key);
    if (!group) {
      group = { taskId: attempt.taskId, taskTitle: attempt.taskTitle, students: new Set() };
      groups.set(key, group);
    }
    group.students.add(attempt.studentName);
  }

  return [...groups.values()]
    .filter((group) => group.students.size >= 2)
    .map((group) => ({
      taskId: group.taskId,
      taskTitle: group.taskTitle,
      studentNames: [...group.students].sort((a, b) => a.localeCompare(b, 'uk'))
    }))
    .sort(
      (a, b) =>
        a.taskTitle.localeCompare(b.taskTitle, 'uk') || a.studentNames[0].localeCompare(b.studentNames[0], 'uk')
    );
}
