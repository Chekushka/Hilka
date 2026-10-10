import { describe, expect, it } from 'vitest';
import { lessonNeighbours, lessonSteps, resolveLessonTasks, stepAfter, stepBefore, type LessonTaskSummary } from './view';

function summary(slug: string, sessionOnly = false): LessonTaskSummary {
  return { id: `id-${slug}`, slug, title: slug, type: 'code', difficulty: 1, sessionOnly, topicId: 'topic', fileDelivery: false };
}

describe('resolveLessonTasks', () => {
  it('keeps lesson order and drops ids that did not resolve', () => {
    const byId = new Map([
      ['1', 'one'],
      ['3', 'three']
    ]);
    expect(resolveLessonTasks(['3', '2', '1'], byId)).toEqual(['three', 'one']);
  });
});

describe('lessonSteps', () => {
  it('walks core tasks, then additional ones, skipping session-only tasks', () => {
    expect(lessonSteps([summary('a'), summary('p', true)], [summary('b')])).toEqual([
      { slug: 'a', role: 'core' },
      { slug: 'b', role: 'additional' }
    ]);
  });
});

describe('stepAfter', () => {
  const steps = lessonSteps([summary('a')], [summary('b')]);

  it('returns the following step, crossing from core into additional', () => {
    expect(stepAfter(steps, 'a')).toEqual({ slug: 'b', role: 'additional' });
  });

  it('returns null after the last step or for a slug not in the lesson', () => {
    expect(stepAfter(steps, 'b')).toBeNull();
    expect(stepAfter(steps, 'zzz')).toBeNull();
  });
});

describe('stepBefore', () => {
  const steps = lessonSteps([summary('a')], [summary('b')]);

  it('returns the previous step, crossing back from additional into core', () => {
    expect(stepBefore(steps, 'b')).toEqual({ slug: 'a', role: 'core' });
  });

  it('is null on the first step and for a slug not in the lesson', () => {
    expect(stepBefore(steps, 'a')).toBeNull();
    expect(stepBefore(steps, 'missing')).toBeNull();
  });
});

describe('lessonNeighbours', () => {
  const outline = [
    { slug: 'one', title: 'One' },
    { slug: 'two', title: 'Two' },
    { slug: 'three', title: 'Three' }
  ];

  it('numbers lessons from 1 in list order and names both neighbours', () => {
    expect(lessonNeighbours(outline, 'two')).toEqual({ number: 2, total: 3, previous: outline[0], next: outline[2] });
  });

  it('has no previous lesson for the first and no next one for the last', () => {
    expect(lessonNeighbours(outline, 'one')?.previous).toBeNull();
    expect(lessonNeighbours(outline, 'three')?.next).toBeNull();
  });

  it('is null for a lesson not in the list', () => {
    expect(lessonNeighbours(outline, 'missing')).toBeNull();
  });
});
