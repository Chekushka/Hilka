import { describe, expect, it } from 'vitest';
import { mergeProgress } from '@/lib/practice/progress';
import { taskXp, topicProgress, totalXp, XP_BY_DIFFICULTY, type PracticeTaskMeta } from './progress';

function task(slug: string, overrides: Partial<PracticeTaskMeta> = {}): PracticeTaskMeta {
  return {
    slug,
    difficulty: 1,
    topicSlug: 'loops',
    topicTitle: 'Цикли',
    topicOrder: 2,
    grades: [7],
    ...overrides
  };
}

describe('taskXp', () => {
  it('grows with difficulty', () => {
    const values = ([1, 2, 3, 4, 5] as const).map(taskXp);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(5);
  });
});

describe('totalXp', () => {
  const tasks = [task('a', { difficulty: 1 }), task('b', { difficulty: 3 }), task('c', { difficulty: 5 })];

  it('sums the XP of completed tasks only', () => {
    expect(totalXp(tasks, new Set(['a', 'c']))).toBe(XP_BY_DIFFICULTY[1] + XP_BY_DIFFICULTY[5]);
  });

  it('is zero with nothing completed', () => {
    expect(totalXp(tasks, new Set())).toBe(0);
  });

  it('ignores a completed slug whose task no longer exists', () => {
    expect(totalXp(tasks, new Set(['a', 'removed-task']))).toBe(XP_BY_DIFFICULTY[1]);
  });

  it('counts a task listed twice only once', () => {
    expect(totalXp([task('a'), task('a', { grades: [8] })], new Set(['a']))).toBe(XP_BY_DIFFICULTY[1]);
  });

  it('agrees whichever order two machines are merged in — XP follows the union of slugs', () => {
    const one = { completedTaskSlugs: ['a'] };
    const two = { completedTaskSlugs: ['b', 'c'] };
    const oneFirst = totalXp(tasks, new Set(mergeProgress(one, two).completedTaskSlugs));
    const twoFirst = totalXp(tasks, new Set(mergeProgress(two, one).completedTaskSlugs));
    expect(oneFirst).toBe(twoFirst);
    expect(oneFirst).toBe(totalXp(tasks, new Set(['a', 'b', 'c'])));
  });
});

describe('topicProgress', () => {
  const tasks = [
    task('loop-1'),
    task('loop-2'),
    task('intro-1', { topicSlug: 'intro', topicTitle: 'Вступ', topicOrder: 1 }),
    task('g8-1', { topicSlug: 'lists', topicTitle: 'Списки', topicOrder: 3, grades: [8] })
  ];

  it("lists a grade's topics in curriculum order with done and total counts", () => {
    expect(topicProgress(tasks, new Set(['loop-2']), 7)).toEqual([
      { slug: 'intro', title: 'Вступ', done: 0, total: 1 },
      { slug: 'loops', title: 'Цикли', done: 1, total: 2 }
    ]);
  });

  it('leaves out topics with no task in that grade', () => {
    expect(topicProgress(tasks, new Set(), 8).map((topic) => topic.slug)).toEqual(['lists']);
  });

  it('counts a task that appears twice only once', () => {
    expect(topicProgress([task('a'), task('a')], new Set(['a']), 7)).toEqual([
      { slug: 'loops', title: 'Цикли', done: 1, total: 1 }
    ]);
  });
});
