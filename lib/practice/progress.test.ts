import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  hasCompletedTask,
  hasCompletedTheory,
  isValidPracticeProgress,
  markTaskCompleted,
  markTheoryCompleted,
  mergeProgress
} from './progress';

describe('markTaskCompleted', () => {
  it('adds a new slug', () => {
    const progress = markTaskCompleted({ completedTaskSlugs: ['a'] }, 'b');
    expect(progress.completedTaskSlugs).toEqual(['a', 'b']);
  });

  it('keeps the character look', () => {
    const progress = markTaskCompleted({ completedTaskSlugs: [], look: { body: 'sky' } }, 'a');
    expect(progress.look).toEqual({ body: 'sky' });
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

  it("keeps this device's look over the code's, and takes the code's when this device has none", () => {
    const here = { completedTaskSlugs: [], look: { body: 'sky' } };
    const code = { completedTaskSlugs: ['a'], look: { body: 'rose' } };
    expect(mergeProgress(here, code).look).toEqual({ body: 'sky' });
    expect(mergeProgress({ completedTaskSlugs: [] }, code).look).toEqual({ body: 'rose' });
    expect(mergeProgress({ completedTaskSlugs: [] }, { completedTaskSlugs: [] })).toEqual({ completedTaskSlugs: [] });
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

  it('accepts a stored look and rejects a malformed one', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: [], look: { body: 'sky' } })).toBe(true);
    expect(isValidPracticeProgress({ completedTaskSlugs: [], look: { body: 1 } })).toBe(false);
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

describe('theory progress', () => {
  it('marks a lesson once, and merges both sides as a union', () => {
    const once = markTheoryCompleted(EMPTY_PROGRESS, 'g7-26-variables');
    expect(markTheoryCompleted(once, 'g7-26-variables')).toBe(once);
    expect(hasCompletedTheory(once, 'g7-26-variables')).toBe(true);
    expect(hasCompletedTheory(EMPTY_PROGRESS, 'g7-26-variables')).toBe(false);
    const other = markTheoryCompleted(EMPTY_PROGRESS, 'g7-27-arithmetic');
    expect(mergeProgress(once, other).completedTheorySlugs).toEqual(['g7-26-variables', 'g7-27-arithmetic']);
    // Progress from before theory cards keeps its old shape.
    expect(mergeProgress(EMPTY_PROGRESS, EMPTY_PROGRESS)).toEqual({ completedTaskSlugs: [] });
  });

  it('validates the theory list like the task list, and accepts progress without it', () => {
    expect(isValidPracticeProgress({ completedTaskSlugs: [], completedTheorySlugs: ['g7-25-intro'] })).toBe(true);
    expect(isValidPracticeProgress({ completedTaskSlugs: [], completedTheorySlugs: 'g7-25-intro' })).toBe(false);
    expect(isValidPracticeProgress({ completedTaskSlugs: [], completedTheorySlugs: [''] })).toBe(false);
    expect(isValidPracticeProgress({ completedTaskSlugs: [], completedTheorySlugs: Array(301).fill('a') })).toBe(false);
  });
});
