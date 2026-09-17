/**
 * The publish gate for `quiz` (docs/TASK_SCHEMA.md, "Reference solutions"):
 * nothing executes and there is no separate reference solution — the correct
 * answer lives entirely in `checks`. So instead of running anything, this
 * confirms the checks are internally consistent with the payload: every
 * `choice_equals` index actually names an option, and — on a single-answer
 * quiz — names exactly one. Catches an authoring typo (an index that no
 * longer exists after an option was deleted, or two "correct" answers on a
 * quiz that only accepts one) before a student ever sees it.
 */
import type { Check } from '@/lib/checker';
import type { QuizPayload } from './types';

export function validateQuizChecks(payload: QuizPayload, checks: Check[]): string[] {
  const errors: string[] = [];
  const choiceChecks = checks.filter(
    (check): check is Check & { kind: 'choice_equals' } => check.kind === 'choice_equals'
  );

  if (choiceChecks.length === 0) {
    errors.push('a quiz task needs at least one choice_equals check');
  }

  for (const check of choiceChecks) {
    if (check.indices.length === 0) {
      errors.push('choice_equals needs at least one index');
    }
    if (!payload.multiple && check.indices.length > 1) {
      errors.push('choice_equals names more than one index, but this quiz only accepts one (multiple: false)');
    }
    for (const index of check.indices) {
      if (index < 0 || index >= payload.options.length) {
        errors.push(`choice_equals references option ${index}, but there are only ${payload.options.length}`);
      }
    }
  }

  return errors;
}
