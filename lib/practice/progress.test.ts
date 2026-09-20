import { describe, expect, it } from 'vitest';
import { hasCompletedTask, isValidPracticeProgress, markTaskCompleted, mergeProgress } from './progress';

describe('markTaskCompleted', () => {
  it('adds a new slug', () => {
    const progress = markTaskCompleted({ completedTaskSlugs: ['a'] }, 'b');
    expect(progress.completedTaskSlugs).toEqual(['a', 'b']);
  });

  it('is idempotent — marking the same task twice does not duplicate it', () => {
    const once = markTaskCompleted({ completedTaskSlugs: [] }, 'a');
    const twice = markTaskCompleted(once, 'a');
    expect(twice.completedTaskSlugs).toEqual(['a']);
  });
});

describe('mergeProgress', () => {
  it('unions two divergent local states, never replaces', () => {
    const merged = mergeProgress({ completedTaskSlugs: ['a', 'b'] }, { completedTaskSlugs: ['b', 'c'] });
    expect(new Set(merged.completedTaskSlugs)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('does not lose progress from either side when restoring in the wrong order', () => {
    const machineOne = { completedTaskSlugs: ['square'] };
    const machineTwo = { completedTaskSlugs: ['triangle'] };
    const oneFirst = new Set(mergeProgress(machineOne, machineTwo).completedTaskSlugs);
    const twoFirst = new Set(mergeProgress(machineTwo, machineOne).completedTaskSlugs);
    expect(oneFirst).toEqual(twoFirst);
  });
});

describe('hasCompletedTask', () => {
  it('is true once a slug has been marked', () => {
    expect(hasCompletedTask({ completedTaskSlugs: ['a'] }, 'a')).toBe(true);
  });

  it('is false for an unmarked slug', () => {
    expect(hasCompletedTask({ completedTaskSlugs: ['a'] }, 'b')).toBe(false);
  });
});

describe('isValidPracticeProgress', () => {
  it('accepts a well-formed progress object', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: ['g7-turtle-square'] })).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: [] })).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(isValidPracticeProgress('not an object')).toBe(false);
    expect(isValidPracticeProgress(null)).toBe(false);
  });

  it('rejects a non-array completedTaskSlugs', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: 'a' })).toBe(false);
  });

  it('rejects a slug list with a non-string entry', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: ['a', 5] })).toBe(false);
  });

  it('rejects an oversized payload — a caller storing a JSON blob, not a slug list', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: Array(501).fill('a') })).toBe(false);
  });

  it('rejects an empty-string slug', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: [''] })).toBe(false);
  });
});
