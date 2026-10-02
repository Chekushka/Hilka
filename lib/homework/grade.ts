/**
 * A suggested grade for one student's homework (docs/HOMEWORK.md, section 4).
 * Same points, bands and high-band rule as a graded lesson (lib/grading/), with
 * what homework adds:
 *
 * - a main task earns the best of its counted Checks, each weighed by what it
 *   was: the first Check at full credit, a fix at `fixCredit`, both times the
 *   hint credit and the late credit of the moment it was made;
 * - an improvement task counts on its first Check only, and its points can only
 *   recover what the main tasks lost — the share never exceeds 100%;
 * - the 10–12 band needs a hard task passed on a first Check (a main task or an
 *   improvement task); a fix does not open it.
 *
 * Pure. Voided attempts must already be left out.
 */
import { DEFAULT_GRADING, type GradingConfig } from '@/lib/grading/config';
import { gradeForShare, taskPoints, type GradedAttempt, type GradedTask, type SuggestedGrade } from '@/lib/grading/grade';
import { lateCredit } from './rules';

export interface HomeworkGrade extends SuggestedGrade {
  /** Tasks whose credit came from a fix. */
  fixedTasks: number;
  /** Attempts that counted and were made after the deadline. */
  lateAttempts: number;
  /** Points the improvement tasks brought back, after the cap. */
  recovered: number;
}

function inOrder(attempts: readonly GradedAttempt[]): GradedAttempt[] {
  return [...attempts].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

function caseShare(attempt: GradedAttempt): number {
  return attempt.passed ? 1 : Math.min(1, Math.max(0, attempt.score ?? 0));
}

export function suggestHomeworkGrade(
  mainTasks: readonly GradedTask[],
  improvementTasks: readonly GradedTask[],
  attempts: readonly GradedAttempt[],
  dueAt: string | null,
  config: GradingConfig = DEFAULT_GRADING
): HomeworkGrade {
  const dueMs = dueAt === null ? null : Date.parse(dueAt);
  const credit = (attempt: GradedAttempt, kindFactor: number) =>
    caseShare(attempt) *
    kindFactor *
    (attempt.hintsUsed > 0 ? config.hintCredit : 1) *
    lateCredit(Date.parse(attempt.createdAt), dueMs, config);

  let possible = 0;
  let mainEarned = 0;
  let improvementEarned = 0;
  let solvedHard = false;
  let attemptedAny = false;
  let fixedTasks = 0;
  let lateAttempts = 0;

  const countLate = (attempt: GradedAttempt) => {
    if (dueMs !== null && Date.parse(attempt.createdAt) > dueMs) lateAttempts += 1;
  };

  for (const task of mainTasks) {
    const points = taskPoints(task.difficulty, config);
    possible += points;
    const counted = inOrder(attempts.filter((attempt) => attempt.taskId === task.id)).slice(0, 1 + config.maxFixes);
    if (counted.length === 0) continue;
    attemptedAny = true;
    counted.forEach(countLate);
    let best = 0;
    let bestIsFix = false;
    counted.forEach((attempt, index) => {
      const value = credit(attempt, index === 0 ? 1 : config.fixCredit);
      if (value > best) {
        best = value;
        bestIsFix = index > 0;
      }
    });
    mainEarned += points * best;
    if (bestIsFix) fixedTasks += 1;
    if (counted[0].passed && task.difficulty >= config.highBandMinDifficulty) solvedHard = true;
  }

  for (const task of improvementTasks) {
    const first = inOrder(attempts.filter((attempt) => attempt.taskId === task.id))[0];
    if (!first) continue;
    attemptedAny = true;
    countLate(first);
    improvementEarned += taskPoints(task.difficulty, config) * credit(first, 1);
    if (first.passed && task.difficulty >= config.highBandMinDifficulty) solvedHard = true;
  }

  const earned = Math.min(possible, mainEarned + improvementEarned);
  const recovered = earned - mainEarned;
  const share = possible === 0 ? 0 : earned / possible;
  const extras = { fixedTasks, lateAttempts, recovered };
  if (!attemptedAny) return { earned, possible, share, grade: null, capped: false, ...extras };

  const uncapped = gradeForShare(share, config);
  const capped = uncapped > config.highBandCap && !solvedHard;
  return { earned, possible, share, grade: capped ? config.highBandCap : uncapped, capped, ...extras };
}

/** `suggestHomeworkGrade` for every roster name, in roster order. */
export function suggestHomeworkGradesForRoster(
  roster: readonly string[],
  mainTasks: readonly GradedTask[],
  improvementTasks: readonly GradedTask[],
  attempts: readonly (GradedAttempt & { studentName: string })[],
  dueAt: string | null,
  config: GradingConfig = DEFAULT_GRADING
): { studentName: string; suggestion: HomeworkGrade }[] {
  return roster.map((studentName) => ({
    studentName,
    suggestion: suggestHomeworkGrade(
      mainTasks,
      improvementTasks,
      attempts.filter((attempt) => attempt.studentName === studentName),
      dueAt,
      config
    )
  }));
}
