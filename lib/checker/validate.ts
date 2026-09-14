/**
 * Authoring-time validation. TASK_SCHEMA.md states these as rules that are not
 * optional, and says to enforce them rather than trust convention — so the
 * authoring UI calls this instead of reimplementing the rules in a form.
 */
import type { Check } from './types';

export interface ValidationError {
  /** Index in the checks array, or -1 for a whole-task problem. */
  at: number;
  message: string;
}

export interface TaskShape {
  checks: Check[];
  cases?: { checks?: Check[] }[];
  reference?: { code?: string } | null;
  type?: string;
  payload?: { broken?: string };
}

export function validateTaskChecks(task: TaskShape): ValidationError[] {
  const errors: ValidationError[] = [];
  const hasCases = (task.cases?.length ?? 0) > 0;

  const everyCheck: { check: Check; at: number }[] = task.checks.map((check, at) => ({ check, at }));
  task.cases?.forEach((runCase) => {
    runCase.checks?.forEach((check) => everyCheck.push({ check, at: -1 }));
  });

  for (const { check, at } of everyCheck) {
    // Prompt wording varies legitimately between correct solutions. One student
    // prints «Введіть вагу:», another prints nothing; both are right, and an
    // exact match fails one of them.
    if (hasCases && check.kind === 'stdout_equals') {
      errors.push({
        at,
        message:
          'stdout_equals cannot be used on a task with cases — use number_close, numbers_equal or last_line_equals'
      });
    }
    if (check.kind === 'number_close' && check.tol < 0) {
      errors.push({ at, message: 'number_close tolerance cannot be negative' });
    }
    if (check.kind === 'numbers_equal' && check.tol < 0) {
      errors.push({ at, message: 'numbers_equal tolerance cannot be negative' });
    }
    if (check.kind === 'uses' && !check.any?.length && !check.all?.length) {
      errors.push({ at, message: 'uses needs at least one name in any or all' });
    }
  }

  const needsReference = task.checks.some(
    (check) => check.kind === 'shape_equals' || check.kind === 'stdout_equals'
  );
  if (needsReference && !task.reference?.code) {
    errors.push({
      at: -1,
      message: 'a reference solution is required: expected results are computed, never typed'
    });
  }

  return errors;
}
