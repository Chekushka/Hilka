/**
 * Structural validation for `predict`'s choice mode (docs/TASK_SCHEMA.md),
 * the same idea as `lib/task/quiz.ts`'s `validateQuizChecks` — a
 * `choice_equals` index that no longer names an option, or names more than
 * one, is an authoring mistake, not something a runtime check should have
 * to fail gracefully. Unlike quiz, predict-choice is always single-answer
 * (there is exactly one real printed output), so `indices` must have
 * exactly one entry, not merely at-most-one.
 */
import type { Check } from '@/lib/checker';
import type { PredictPayload } from './types';

export function validatePredictChoiceChecks(payload: PredictPayload, checks: Check[]): string[] {
  const errors: string[] = [];
  const choiceChecks = checks.filter(
    (check): check is Check & { kind: 'choice_equals' } => check.kind === 'choice_equals'
  );

  if (choiceChecks.length !== 1) {
    errors.push('a choice-mode predict task needs exactly one choice_equals check');
    return errors;
  }

  const [check] = choiceChecks;
  if (check.indices.length !== 1) {
    errors.push('choice_equals must name exactly one index — a prediction has exactly one real output');
  }
  for (const index of check.indices) {
    if (index < 0 || index >= (payload.options?.length ?? 0)) {
      errors.push(`choice_equals references option ${index}, but there are only ${payload.options?.length ?? 0}`);
    }
  }

  return errors;
}
