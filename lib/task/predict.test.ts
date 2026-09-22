import { describe, expect, it } from 'vitest';
import { validatePredictChoiceChecks } from './predict';
import type { PredictPayload } from './types';

const payload: PredictPayload = {
  type: 'predict',
  prompt: 'Що виведе програма?',
  code: 'print(2 + 3 * 4)',
  answerMode: 'choice',
  options: ['20', '14', '8']
};

describe('validatePredictChoiceChecks', () => {
  it('accepts exactly one index in range', () => {
    expect(validatePredictChoiceChecks(payload, [{ kind: 'choice_equals', indices: [1] }])).toEqual([]);
  });

  it('rejects no choice_equals check at all', () => {
    expect(validatePredictChoiceChecks(payload, [])).toEqual([
      'a choice-mode predict task needs exactly one choice_equals check'
    ]);
  });

  it('rejects more than one choice_equals check', () => {
    const errors = validatePredictChoiceChecks(payload, [
      { kind: 'choice_equals', indices: [0] },
      { kind: 'choice_equals', indices: [1] }
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than one index — a prediction has exactly one real output', () => {
    const errors = validatePredictChoiceChecks(payload, [{ kind: 'choice_equals', indices: [0, 1] }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an index that names no option', () => {
    const errors = validatePredictChoiceChecks(payload, [{ kind: 'choice_equals', indices: [9] }]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
