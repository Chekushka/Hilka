import { describe, expect, it } from 'vitest';
import { canSubmit, checksLeft, improvementOpen, lateCredit, taskState, type SessionRules } from './rules';

const homework: SessionRules = { kind: 'homework', mode: 'graded', taskIds: ['a', 'b'], improvementTaskIds: ['x'] };
const gradedLesson: SessionRules = { kind: 'lesson', mode: 'graded', taskIds: ['a', 'b'], improvementTaskIds: [] };
const practiceLesson: SessionRules = { kind: 'lesson', mode: 'practice', taskIds: ['a', 'b'], improvementTaskIds: [] };

let minute = 0;
function at(taskId: string, passed: boolean) {
  minute += 1;
  return { taskId, passed, createdAt: `2026-10-05T10:${String(minute).padStart(2, '0')}:00.000Z` };
}

describe('taskState in homework', () => {
  it('passes at full value on the first Check', () => {
    expect(taskState(homework, 'a', [at('a', true)])).toEqual({ status: 'passed', viaFix: false });
  });

  it('allows two fixes after a failed first Check, then stops', () => {
    const first = at('a', false);
    expect(taskState(homework, 'a', [first])).toEqual({ status: 'fixable', fixesLeft: 2 });
    const second = at('a', false);
    expect(taskState(homework, 'a', [first, second])).toEqual({ status: 'fixable', fixesLeft: 1 });
    expect(taskState(homework, 'a', [first, second, at('a', false)])).toEqual({ status: 'failed' });
  });

  it('marks a pass on a fix as such', () => {
    expect(taskState(homework, 'a', [at('a', false), at('a', false), at('a', true)])).toEqual({
      status: 'passed',
      viaFix: true
    });
  });

  it('ignores a Check beyond the allowed ones, even a passing one', () => {
    const attempts = [at('a', false), at('a', false), at('a', false), at('a', true)];
    expect(taskState(homework, 'a', attempts)).toEqual({ status: 'failed' });
  });

  it('reads attempts in time order, whatever order they arrive in', () => {
    const fail = at('a', false);
    const pass = at('a', true);
    expect(taskState(homework, 'a', [pass, fail])).toEqual({ status: 'passed', viaFix: true });
  });

  it('gives an improvement task one Check', () => {
    expect(taskState(homework, 'x', [at('x', false)])).toEqual({ status: 'failed' });
  });
});

describe('taskState in a lesson', () => {
  it('locks a graded task to its first Check, as the room always did', () => {
    expect(taskState(gradedLesson, 'a', [at('a', false)])).toEqual({ status: 'failed' });
    expect(taskState(gradedLesson, 'a', [at('a', true)])).toEqual({ status: 'passed', viaFix: false });
  });

  it('never limits a practice-mode session', () => {
    const attempts = [at('a', false), at('a', false), at('a', false), at('a', false)];
    expect(taskState(practiceLesson, 'a', attempts)).toEqual({ status: 'retry' });
    expect(canSubmit(practiceLesson, 'a', attempts)).toBe(true);
  });

  it('keeps accepting Checks on a practice-mode task after it passed', () => {
    expect(canSubmit(practiceLesson, 'a', [at('a', true), at('a', true)])).toBe(true);
  });
});

describe('improvementOpen', () => {
  it('stays closed until a main task fails its first Check', () => {
    expect(improvementOpen(homework, [])).toBe(false);
    expect(improvementOpen(homework, [at('a', true), at('b', true)])).toBe(false);
    expect(improvementOpen(homework, [at('a', true), at('b', false)])).toBe(true);
  });

  it('stays open after the failed task is fixed — the points were still lost', () => {
    expect(improvementOpen(homework, [at('b', false), at('b', true)])).toBe(true);
  });

  it('is never open outside homework or without improvement tasks', () => {
    expect(improvementOpen(gradedLesson, [at('a', false)])).toBe(false);
    expect(improvementOpen({ ...homework, improvementTaskIds: [] }, [at('a', false)])).toBe(false);
  });
});

describe('canSubmit', () => {
  it('refuses an improvement task before any point is lost', () => {
    expect(canSubmit(homework, 'x', [at('a', true)])).toBe(false);
    expect(canSubmit(homework, 'x', [at('a', false)])).toBe(true);
  });

  it('refuses a second Check on a passed task and a fourth on a failing one', () => {
    expect(canSubmit(homework, 'a', [at('a', true)])).toBe(false);
    expect(canSubmit(homework, 'a', [at('a', false), at('a', false)])).toBe(true);
    expect(canSubmit(homework, 'a', [at('a', false), at('a', false), at('a', false)])).toBe(false);
  });

  it('refuses a second Check in a graded lesson — the reload hole, closed server-side', () => {
    expect(canSubmit(gradedLesson, 'a', [])).toBe(true);
    expect(canSubmit(gradedLesson, 'a', [at('a', false)])).toBe(false);
  });
});

describe('lateCredit', () => {
  const due = Date.parse('2026-10-10T18:00:00.000Z');
  const hours = (h: number) => due + h * 60 * 60 * 1000;

  it('is full on time and without a deadline', () => {
    expect(lateCredit(hours(-1), due)).toBe(1);
    expect(lateCredit(due, due)).toBe(1);
    expect(lateCredit(hours(500), null)).toBe(1);
  });

  it('is 70% up to two days late and 50% after', () => {
    expect(lateCredit(hours(0.1), due)).toBe(0.7);
    expect(lateCredit(hours(48), due)).toBe(0.7);
    expect(lateCredit(hours(48.1), due)).toBe(0.5);
    expect(lateCredit(hours(24 * 7), due)).toBe(0.5);
  });
});

describe('checksLeft', () => {
  it('counts a homework task down from a first Check and two fixes', () => {
    expect(checksLeft(homework, 'a', [])).toBe(3);
    const first = at('a', false);
    expect(checksLeft(homework, 'a', [first])).toBe(2);
    expect(checksLeft(homework, 'a', [first, at('a', false), at('a', false)])).toBe(0);
  });

  it('is zero once a task is passed', () => {
    expect(checksLeft(homework, 'a', [at('a', true)])).toBe(0);
    expect(checksLeft(gradedLesson, 'a', [at('a', true)])).toBe(0);
  });

  it('gives an improvement task and a graded lesson one Check', () => {
    expect(checksLeft(homework, 'x', [])).toBe(1);
    expect(checksLeft(gradedLesson, 'b', [])).toBe(1);
    expect(checksLeft(gradedLesson, 'b', [at('b', false)])).toBe(0);
  });

  it('sets no limit in a practice-mode lesson', () => {
    expect(checksLeft(practiceLesson, 'a', [at('a', false)])).toBeNull();
  });
});

describe('route tasks', () => {
  const routed = (rules: SessionRules): SessionRules => ({ ...rules, routeTaskIds: ['r'] });

  it('never limit Checks, in a graded lesson and in homework alike', () => {
    for (const rules of [routed(gradedLesson), routed(homework)]) {
      const attempts = [at('r', false), at('r', false), at('r', false), at('r', false)];
      expect(taskState(rules, 'r', attempts)).toEqual({ status: 'retry' });
      expect(canSubmit(rules, 'r', attempts)).toBe(true);
      expect(checksLeft(rules, 'r', attempts)).toBeNull();
    }
  });

  it('pass without counting as a fix in homework', () => {
    expect(taskState(routed(homework), 'r', [at('r', false), at('r', true)])).toEqual({ status: 'passed', viaFix: false });
  });

  it('leave the main tasks’ limits as they were', () => {
    expect(canSubmit(routed(gradedLesson), 'a', [at('a', false)])).toBe(false);
  });
});
