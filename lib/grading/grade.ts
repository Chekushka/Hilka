/**
 * A suggested grade for one student in one graded session (docs/AI_CONTEXT.md,
 * "Grading"). Pure — no DOM, no database — and only ever a suggestion: the
 * teacher decides, and students never see this number in Hilka.
 *
 * Only the first attempt on each task counts, because a graded session is
 * final on the first Check (components/session/SessionRoom.tsx). A task with
 * several input cases earns the share of cases it passed (`score`); a task
 * solved after opening a hint earns `hintCredit` of that.
 */
import { DEFAULT_GRADING, type GradingConfig } from './config';

export interface GradedTask {
  id: string;
  difficulty: number;
}

export interface GradedAttempt {
  taskId: string;
  passed: boolean;
  /** 0..1, the share of input cases passed; null for attempts recorded before partial credit existed. */
  score: number | null;
  hintsUsed: number;
  createdAt: string;
}

export interface SuggestedGrade {
  earned: number;
  possible: number;
  /** earned / possible, 0..1. */
  share: number;
  /** null when the student submitted nothing — the teacher's «н», never an automatic 1. */
  grade: number | null;
  /** True when the share alone would give more than `highBandCap`, but no hard task was solved. */
  capped: boolean;
}

export function taskPoints(difficulty: number, config: GradingConfig = DEFAULT_GRADING): number {
  const clamped = Math.min(5, Math.max(1, Math.round(difficulty))) as 1 | 2 | 3 | 4 | 5;
  return config.pointsByDifficulty[clamped];
}

/** The grade a share of points maps to on its own, before the high-band rule. */
export function gradeForShare(share: number, config: GradingConfig = DEFAULT_GRADING): number {
  const index = config.upperBounds.findIndex((bound) => share <= bound);
  return index === -1 ? config.upperBounds.length : index + 1;
}

/** Whether a session can reach the high band at all — otherwise its best grade is `highBandCap`. */
export function sessionAllowsHighBand(tasks: GradedTask[], config: GradingConfig = DEFAULT_GRADING): boolean {
  return tasks.some((task) => task.difficulty >= config.highBandMinDifficulty);
}

export function suggestGrade(
  tasks: GradedTask[],
  attempts: GradedAttempt[],
  config: GradingConfig = DEFAULT_GRADING
): SuggestedGrade {
  const first = new Map<string, GradedAttempt>();
  for (const attempt of attempts) {
    const current = first.get(attempt.taskId);
    if (!current || attempt.createdAt < current.createdAt) first.set(attempt.taskId, attempt);
  }

  let earned = 0;
  let possible = 0;
  let solvedHard = false;
  let attemptedAny = false;
  for (const task of tasks) {
    const points = taskPoints(task.difficulty, config);
    possible += points;
    const attempt = first.get(task.id);
    if (!attempt) continue;
    attemptedAny = true;
    const caseShare = attempt.passed ? 1 : Math.min(1, Math.max(0, attempt.score ?? 0));
    const hintFactor = attempt.hintsUsed > 0 ? config.hintCredit : 1;
    earned += points * caseShare * hintFactor;
    if (attempt.passed && task.difficulty >= config.highBandMinDifficulty) solvedHard = true;
  }

  const share = possible === 0 ? 0 : earned / possible;
  if (!attemptedAny) return { earned, possible, share, grade: null, capped: false };

  const uncapped = gradeForShare(share, config);
  const capped = uncapped > config.highBandCap && !solvedHard;
  return { earned, possible, share, grade: capped ? config.highBandCap : uncapped, capped };
}

/** `suggestGrade` for every roster name, in roster order. */
export function suggestGradesForRoster(
  roster: string[],
  tasks: GradedTask[],
  attempts: (GradedAttempt & { studentName: string })[],
  config: GradingConfig = DEFAULT_GRADING
): { studentName: string; suggestion: SuggestedGrade }[] {
  return roster.map((studentName) => ({
    studentName,
    suggestion: suggestGrade(
      tasks,
      attempts.filter((attempt) => attempt.studentName === studentName),
      config
    )
  }));
}
