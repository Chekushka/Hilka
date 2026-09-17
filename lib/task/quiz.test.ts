import { describe, expect, it } from 'vitest';
import { validateQuizChecks } from './quiz';
import type { QuizPayload } from './types';

const singlePayload: QuizPayload = {
  type: 'quiz',
  prompt: 'Яке ім’я змінної є правильним у Python?',
  options: ['1x', 'x1', 'x-1', 'x 1'],
  multiple: false
};

describe('validateQuizChecks', () => {
  it('accepts a single correct index on a single-answer quiz', () => {
    expect(validateQuizChecks(singlePayload, [{ kind: 'choice_equals', indices: [1] }])).toEqual([]);
  });

  it('accepts several correct indices on a multiple-answer quiz', () => {
    const multiplePayload: QuizPayload = { ...singlePayload, multiple: true };
    expect(validateQuizChecks(multiplePayload, [{ kind: 'choice_equals', indices: [0, 1] }])).toEqual([]);
  });

  it('rejects more than one index on a single-answer quiz', () => {
    const errors = validateQuizChecks(singlePayload, [{ kind: 'choice_equals', indices: [0, 1] }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an index that names no option — the authoring typo this exists to catch', () => {
    const errors = validateQuizChecks(singlePayload, [{ kind: 'choice_equals', indices: [4] }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an empty indices array', () => {
    const errors = validateQuizChecks(singlePayload, [{ kind: 'choice_equals', indices: [] }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a quiz with no choice_equals check at all', () => {
    expect(validateQuizChecks(singlePayload, [])).toEqual([
      'a quiz task needs at least one choice_equals check'
    ]);
  });
});
