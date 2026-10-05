/**
 * The facts a homework's teacher sees per student (docs/HOMEWORK.md, section
 * 5): a large paste with few edits, a program the same in structure as
 * another student's, constructs no lesson so far used. Each is an
 * observation to look at, never a verdict — the class table shows a word, the
 * student card the detail, and nothing changes a grade. Pure.
 */
import type { StudentRef } from '@/lib/classes/roster';
import type { EditorActivity } from '@/lib/task/activity';
import type { TaskPayload } from '@/lib/task/types';
import { taughtConstructs, untaughtConstructs } from './constructs';
import { findSimilarCode, type CodeSubmission, type SimilarGroup } from './similar';

/**
 * A paste of at least this many lines with at most this many edits around it:
 * the program arrived whole. A short paste (a line moved, an example copied
 * from the lesson) is ordinary and never reported.
 */
export const PASTE_RULE = { minLines: 5, maxEdits: 3 } as const;

export function pastedWhole(activity: EditorActivity | null): boolean {
  return activity !== null && activity.largestPasteLines >= PASTE_RULE.minLines && activity.edits <= PASTE_RULE.maxEdits;
}

/** A published task's own programs: what it shows or asks for, and its reference. Fill gaps count as empty. */
export function programsOf(payload: TaskPayload, referenceCode: string | null): string[] {
  const programs: string[] = referenceCode ? [referenceCode] : [];
  switch (payload.type) {
    case 'code':
      programs.push(payload.starter);
      break;
    case 'fix':
      programs.push(payload.broken);
      break;
    case 'fill':
      programs.push(payload.template.replace(/\{\{\d+\}\}/g, ''));
      break;
    case 'predict':
      programs.push(payload.code);
      break;
    case 'parsons':
      programs.push(payload.lines.map((line) => `${'    '.repeat(line.indent)}${line.text}`).join('\n'));
      break;
    default:
      break;
  }
  return programs.filter((program) => program.trim() !== '');
}

export interface ContentTask {
  id: string;
  gradeTags: number[];
  /** The topic's curriculum order (topics.order). */
  topicOrder: number;
  programs: string[];
}

/**
 * What counts as taught for a homework: every construct used by a published
 * task in the homework's grades whose topic comes no later than the latest
 * topic the homework itself covers. The homework's own tasks are always
 * inside that range.
 */
export function taughtForHomework(homeworkTaskIds: readonly string[], content: readonly ContentTask[]): Set<string> {
  const own = content.filter((task) => homeworkTaskIds.includes(task.id));
  if (own.length === 0) return new Set();
  const grades = new Set(own.flatMap((task) => task.gradeTags));
  const latestTopic = Math.max(...own.map((task) => task.topicOrder));
  return taughtConstructs(
    content
      .filter((task) => task.topicOrder <= latestTopic && task.gradeTags.some((grade) => grades.has(grade)))
      .flatMap((task) => task.programs)
  );
}

/** An attempt as the facts read it. */
export interface FactAttempt {
  studentId: string;
  studentName: string;
  taskId: string;
  taskTitle: string;
  passed: boolean;
  /** The submitted program, for `code`, `fix` and `fill`; null otherwise. */
  code: string | null;
  activity: EditorActivity | null;
  createdAt: string;
}

export interface StudentFacts {
  pasted: { taskTitle: string; lines: number; edits: number }[];
  similar: { taskTitle: string; others: string[] }[];
  untaught: { taskTitle: string; constructs: string[] }[];
}

export function hasFacts(facts: StudentFacts): boolean {
  return facts.pasted.length > 0 || facts.similar.length > 0 || facts.untaught.length > 0;
}

/**
 * Every roster student's facts, keyed by id, plus the similar-code groups for the session's
 * own list. `fillTaskIds`: a fill program is mostly its template, the same
 * for everyone by design, so it is never compared for similarity.
 */
export function homeworkFacts(
  roster: readonly StudentRef[],
  attempts: readonly FactAttempt[],
  taught: ReadonlySet<string>,
  fillTaskIds: ReadonlySet<string>
): { byStudent: Map<string, StudentFacts>; similarGroups: SimilarGroup[] } {
  const passingPrograms: CodeSubmission[] = attempts
    .filter((attempt) => attempt.passed && attempt.code !== null && !fillTaskIds.has(attempt.taskId))
    .map((attempt) => ({ ...attempt, code: attempt.code! }));
  const similarGroups = findSimilarCode(passingPrograms);

  const byStudent = new Map<string, StudentFacts>();
  for (const student of roster) {
    const own = attempts.filter((attempt) => attempt.studentId === student.id);
    const taskIds = [...new Set(own.map((attempt) => attempt.taskId))];
    const facts: StudentFacts = { pasted: [], similar: [], untaught: [] };

    for (const taskId of taskIds) {
      const onTask = own
        .filter((attempt) => attempt.taskId === taskId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const title = onTask[0].taskTitle;

      const pastes = onTask.filter((attempt) => pastedWhole(attempt.activity));
      if (pastes.length > 0) {
        const largest = pastes.reduce((a, b) => (b.activity!.largestPasteLines > a.activity!.largestPasteLines ? b : a));
        facts.pasted.push({ taskTitle: title, lines: largest.activity!.largestPasteLines, edits: largest.activity!.edits });
      }

      const latestCode = [...onTask].reverse().find((attempt) => attempt.code !== null)?.code;
      if (latestCode) {
        const constructs = untaughtConstructs(latestCode, taught);
        if (constructs.length > 0) facts.untaught.push({ taskTitle: title, constructs });
      }
    }

    for (const group of similarGroups) {
      if (group.studentIds.includes(student.id)) {
        facts.similar.push({
          taskTitle: group.taskTitle,
          others: group.studentNames.filter((_, index) => group.studentIds[index] !== student.id)
        });
      }
    }
    byStudent.set(student.id, facts);
  }
  return { byStudent, similarGroups };
}
