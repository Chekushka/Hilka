import { describe, expect, it } from 'vitest';
import { lessonSteps, resolveLessonTasks, stepAfter, type LessonTaskSummary } from './view';

function summary(slug: string, sessionOnly = false): LessonTaskSummary {
  return { id: `id-${slug}`, slug, title: slug, type: 'code', difficulty: 1, sessionOnly };
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
