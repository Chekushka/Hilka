import { describe, expect, it } from 'vitest';
import type { SessionRules } from '@/lib/homework/rules';
import { sessionProgress } from './progress';

const homework: SessionRules = { kind: 'homework', mode: 'graded', taskIds: ['a', 'b'], improvementTaskIds: ['x'] };
const gradedLesson: SessionRules = { kind: 'lesson', mode: 'graded', taskIds: ['a', 'b', 'c'], improvementTaskIds: [] };
const practiceLesson: SessionRules = { kind: 'lesson', mode: 'practice', taskIds: ['a', 'b'], improvementTaskIds: [] };

let minute = 0;
function at(taskId: string, passed: boolean) {
  minute += 1;
  return { taskId, passed, createdAt: `2026-10-05T10:${String(minute).padStart(2, '0')}:00.000Z` };
}

describe('sessionProgress', () => {
  it('starts with every task new and every Check left', () => {
    const progress = sessionProgress(homework, []);
    expect(progress.main).toEqual({ total: 2, passed: 0, passedViaFix: 0, failed: 0, inProgress: 0, notStarted: 2 });
    expect(progress.checksLeft).toBe(6);
    expect(progress.complete).toBe(false);
    expect(progress.improvement).toBeNull();
  });

  it('counts a graded lesson down one Check per task, and completes when each is used', () => {
    const attempts = [at('a', true), at('b', false)];
    const midway = sessionProgress(gradedLesson, attempts);
    expect(midway.checksLeft).toBe(1);
    expect(midway.complete).toBe(false);
    const done = sessionProgress(gradedLesson, [...attempts, at('c', true)]);
    expect(done.complete).toBe(true);
    expect(done.main.passed).toBe(2);
    expect(done.main.failed).toBe(1);
    expect(done.checksLeft).toBe(0);
  });

  it('tells homework fixes apart, and opens improvement after a lost point', () => {
    const attempts = [at('a', false), at('a', true), at('b', true)];
    const progress = sessionProgress(homework, attempts);
    expect(progress.main.passed).toBe(2);
    expect(progress.main.passedViaFix).toBe(1);
    expect(progress.complete).toBe(true);
    expect(progress.improvement).toEqual({ total: 1, passed: 0, passedViaFix: 0, failed: 0, inProgress: 0, notStarted: 1 });
  });

  it('keeps a homework task with fixes left in progress', () => {
    const progress = sessionProgress(homework, [at('a', false), at('b', true)]);
    expect(progress.main.inProgress).toBe(1);
    expect(progress.checksLeft).toBe(2);
    expect(progress.complete).toBe(false);
  });

  it('sets no Check limit in a practice-mode lesson, which finishes only when all are passed', () => {
    const tried = sessionProgress(practiceLesson, [at('a', false), at('b', true)]);
    expect(tried.checksLeft).toBeNull();
    expect(tried.complete).toBe(false);
    expect(sessionProgress(practiceLesson, [at('a', false), at('a', true), at('b', true)]).complete).toBe(true);
  });

  it('is never complete with no tasks', () => {
    expect(sessionProgress({ ...gradedLesson, taskIds: [] }, []).complete).toBe(false);
  });
});
