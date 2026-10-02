/**
 * The suggested grade for every roster name in a graded session, whichever
 * kind it is: a graded lesson's rule (lib/grading/grade.ts) or homework's
 * (./grade.ts). One switch, so the class table and the CSV export cannot
 * disagree. Pure.
 */
import { suggestGrade, type GradedAttempt, type GradedTask, type SuggestedGrade } from '@/lib/grading/grade';
import type { AssignmentRule } from '@/lib/seed';
import { assignedTo } from '@/lib/session/assigned';
import type { SessionKind } from '@/lib/session/types';
import { suggestHomeworkGrade, type CheckAttempt, type HomeworkGrade } from './grade';

export interface GradableSession {
  id: string;
  kind: SessionKind;
  roster: string[];
  tasks: GradedTask[];
  improvementTasks: GradedTask[];
  dueAt: string | null;
  /** With a pool, each student is graded on the tasks they were given (lib/seed/assignment.ts). */
  assignment: AssignmentRule;
}

/**
 * `checks`: homework only — every student's Checks in the class checks of this
 * homework (lib/db/sessions.ts, `listCheckAttempts`).
 */
export function suggestSessionGrades(
  session: GradableSession,
  attempts: readonly (GradedAttempt & { studentName: string })[],
  checks: readonly (CheckAttempt & { studentName: string })[] = []
): { studentName: string; suggestion: SuggestedGrade | HomeworkGrade }[] {
  const assigned = assignedTo(session);
  return session.roster.map((studentName) => {
    const own = attempts.filter((attempt) => attempt.studentName === studentName);
    const ownSet = assigned?.(studentName);
    const tasks = ownSet ? session.tasks.filter((task) => ownSet.has(task.id)) : session.tasks;
    return {
      studentName,
      suggestion:
        session.kind === 'homework'
          ? suggestHomeworkGrade(
              tasks,
              session.improvementTasks,
              own,
              session.dueAt,
              checks.filter((check) => check.studentName === studentName)
            )
          : suggestGrade(tasks, own)
    };
  });
}

export function isHomeworkGrade(grade: SuggestedGrade | HomeworkGrade): grade is HomeworkGrade {
  return 'fixedTasks' in grade;
}
