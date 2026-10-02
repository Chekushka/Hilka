/**
 * The suggested grade for every roster name in a graded session, whichever
 * kind it is: a graded lesson's rule (lib/grading/grade.ts) or homework's
 * (./grade.ts). One switch, so the class table and the CSV export cannot
 * disagree. Pure.
 */
import { suggestGradesForRoster, type GradedAttempt, type GradedTask, type SuggestedGrade } from '@/lib/grading/grade';
import type { SessionKind } from '@/lib/session/types';
import { suggestHomeworkGradesForRoster, type HomeworkGrade } from './grade';

export interface GradableSession {
  kind: SessionKind;
  roster: string[];
  tasks: GradedTask[];
  improvementTasks: GradedTask[];
  dueAt: string | null;
}

export function suggestSessionGrades(
  session: GradableSession,
  attempts: readonly (GradedAttempt & { studentName: string })[]
): { studentName: string; suggestion: SuggestedGrade | HomeworkGrade }[] {
  return session.kind === 'homework'
    ? suggestHomeworkGradesForRoster(session.roster, session.tasks, session.improvementTasks, attempts, session.dueAt)
    : suggestGradesForRoster(session.roster, session.tasks, [...attempts]);
}

export function isHomeworkGrade(grade: SuggestedGrade | HomeworkGrade): grade is HomeworkGrade {
  return 'fixedTasks' in grade;
}
