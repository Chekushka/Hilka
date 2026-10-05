/**
 * Where a student stands in a whole session, for the room: how much is done,
 * how many Checks are left, and — once nothing is left to do — the result.
 * Pure, derived from the same rules as everything else in the room
 * (lib/homework/rules.ts), from the student's own attempts.
 *
 * Results are what was solved, never a grade: students do not see the number
 * in Hilka (docs/AI_CONTEXT.md, "Grading").
 */
import { DEFAULT_GRADING, type GradingConfig } from '@/lib/grading/config';
import { checksLeft, improvementOpen, taskState, type SessionRules } from '@/lib/homework/rules';

type Attempt = Parameters<typeof taskState>[2][number];

export interface TaskTally {
  total: number;
  passed: number;
  /** Homework: passed on a fix, worth less. Counted in `passed` too. */
  passedViaFix: number;
  /** No Check left and not passed. */
  failed: number;
  /** Tried, not passed, Checks (or unlimited retries) left. */
  inProgress: number;
  notStarted: number;
}

export interface SessionProgress {
  /** The student's main tasks. */
  main: TaskTally;
  /** Homework's improvement tasks, once they are open; null otherwise. */
  improvement: TaskTally | null;
  /** Checks still allowed on the main tasks altogether; null when the session sets no limit. */
  checksLeft: number | null;
  /**
   * Nothing is left to do on the main tasks: every one passed, or out of
   * Checks. A practice-mode lesson only finishes when everything is passed.
   */
  complete: boolean;
}

function tally(rules: SessionRules, taskIds: readonly string[], attempts: readonly Attempt[], config: GradingConfig): TaskTally {
  const result: TaskTally = { total: taskIds.length, passed: 0, passedViaFix: 0, failed: 0, inProgress: 0, notStarted: 0 };
  for (const taskId of taskIds) {
    const state = taskState(rules, taskId, attempts, config);
    switch (state.status) {
      case 'passed':
        result.passed += 1;
        if (state.viaFix) result.passedViaFix += 1;
        break;
      case 'failed':
        result.failed += 1;
        break;
      case 'new':
        result.notStarted += 1;
        break;
      default:
        result.inProgress += 1;
    }
  }
  return result;
}

export function sessionProgress(
  rules: SessionRules,
  attempts: readonly Attempt[],
  config: GradingConfig = DEFAULT_GRADING
): SessionProgress {
  const main = tally(rules, rules.taskIds, attempts, config);
  const improvement = improvementOpen(rules, attempts)
    ? tally(rules, rules.improvementTaskIds, attempts, config)
    : null;
  let left: number | null = 0;
  for (const taskId of rules.taskIds) {
    const n = checksLeft(rules, taskId, attempts, config);
    if (n === null) {
      left = null;
      break;
    }
    left += n;
  }
  return {
    main,
    improvement,
    checksLeft: left,
    complete: main.total > 0 && main.passed + main.failed === main.total
  };
}
