/**
 * What a student may still do on a session task, and how late work counts
 * (docs/HOMEWORK.md, sections 1 and 4). Pure, and shared by both sides: the
 * room uses it to show what is left, `POST /api/attempts` uses it to refuse an
 * attempt the rules do not allow — the room alone could be reloaded around.
 *
 * Every attempt passed in here must already exclude voided ones: a voided
 * attempt frees the try it used (lib/db/schema.ts, `attempts.voided_at`).
 */
import { DEFAULT_GRADING, type GradingConfig } from '@/lib/grading/config';
import type { GradedAttempt } from '@/lib/grading/grade';
import type { SessionKind, SessionMode } from '@/lib/session/types';

export interface SessionRules {
  kind: SessionKind;
  mode: SessionMode;
  /** The session's main tasks (`sessions.task_ids`). */
  taskIds: readonly string[];
  /** Homework only: offered once a point is lost, worth no more than what was lost. */
  improvementTaskIds: readonly string[];
}

/** Where one task stands for one student. */
export type TaskState =
  | { status: 'new' }
  /** Passed. `viaFix`: on a Check after a failed first one (homework), worth less. */
  | { status: 'passed'; viaFix: boolean }
  /** Homework: failed so far, with this many fixes still allowed. */
  | { status: 'fixable'; fixesLeft: number }
  /** No Check left: a graded first Check failed, or homework fixes ran out. */
  | { status: 'failed' }
  /** A practice-mode session: tried, not passed, as many retries as wanted. */
  | { status: 'retry' };

type Attempt = Pick<GradedAttempt, 'taskId' | 'passed' | 'createdAt'>;

function inOrder<T extends Attempt>(attempts: readonly T[]): T[] {
  return [...attempts].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** How many Checks a task allows in total, or null for no limit. */
function checksAllowed(rules: SessionRules, taskId: string, config: GradingConfig): number | null {
  if (rules.kind === 'homework') {
    return rules.improvementTaskIds.includes(taskId) ? 1 : 1 + config.maxFixes;
  }
  return rules.mode === 'graded' ? 1 : null;
}

/** `attempts` may hold any of the student's attempts; only this task's are read. */
export function taskState(
  rules: SessionRules,
  taskId: string,
  attempts: readonly Attempt[],
  config: GradingConfig = DEFAULT_GRADING
): TaskState {
  const mine = inOrder(attempts.filter((attempt) => attempt.taskId === taskId));
  if (mine.length === 0) return { status: 'new' };
  const allowed = checksAllowed(rules, taskId, config);
  const counted = allowed === null ? mine : mine.slice(0, allowed);
  const pass = counted.findIndex((attempt) => attempt.passed);
  if (pass !== -1) return { status: 'passed', viaFix: rules.kind === 'homework' && pass > 0 };
  if (allowed === null) return { status: 'retry' };
  if (counted.length >= allowed) return { status: 'failed' };
  return { status: 'fixable', fixesLeft: allowed - counted.length };
}

/**
 * How many more Checks this task allows the student, or null when a
 * practice-mode lesson sets no limit — what the room shows beside each task.
 * Zero once the task is passed or out of Checks.
 */
export function checksLeft(
  rules: SessionRules,
  taskId: string,
  attempts: readonly Attempt[],
  config: GradingConfig = DEFAULT_GRADING
): number | null {
  const allowed = checksAllowed(rules, taskId, config);
  if (allowed === null) return null;
  const state = taskState(rules, taskId, attempts, config);
  if (state.status === 'new') return allowed;
  return state.status === 'fixable' ? state.fixesLeft : 0;
}

/**
 * Homework's improvement tasks appear once the student has lost points: a
 * main task whose first Check did not pass. Before that the main tasks come
 * first, and there is nothing to improve.
 */
export function improvementOpen(rules: SessionRules, attempts: readonly Attempt[]): boolean {
  if (rules.kind !== 'homework' || rules.improvementTaskIds.length === 0) return false;
  return rules.taskIds.some((taskId) => {
    const first = inOrder(attempts.filter((attempt) => attempt.taskId === taskId))[0];
    return first !== undefined && !first.passed;
  });
}

/** Whether one more Check on this task may be recorded — the server's rule. */
export function canSubmit(
  rules: SessionRules,
  taskId: string,
  attempts: readonly Attempt[],
  config: GradingConfig = DEFAULT_GRADING
): boolean {
  if (rules.improvementTaskIds.includes(taskId) && !improvementOpen(rules, attempts)) return false;
  // A practice-mode lesson never limits — not even after a pass, which students repeat freely.
  if (checksAllowed(rules, taskId, config) === null) return true;
  const state = taskState(rules, taskId, attempts, config);
  return state.status === 'new' || state.status === 'fixable';
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * The credit multiplier for work done at `atMs` against a deadline: 1 on
 * time, then the configured steps. No deadline means never late.
 */
export function lateCredit(atMs: number, dueAtMs: number | null, config: GradingConfig = DEFAULT_GRADING): number {
  if (dueAtMs === null || atMs <= dueAtMs) return 1;
  const lateHours = (atMs - dueAtMs) / HOUR_MS;
  const step = config.lateSteps.find((candidate) => lateHours <= candidate.withinHours);
  return step ? step.credit : config.lateCreditBeyond;
}
