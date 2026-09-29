import { describe, expect, it } from 'vitest';
import type { PracticeTaskMeta } from './progress';
import { topicMap, type MapLesson } from './topic-map';

function task(slug: string, topicSlug: string, topicOrder: number, grades = [7]): PracticeTaskMeta {
  return { slug, difficulty: 1, topicSlug, topicTitle: topicSlug.toUpperCase(), topicOrder, grades };
}

const tasks = [
  task('p1', 'print', 1),
  task('p2', 'print', 1),
  task('v1', 'vars', 2),
  task('v2', 'vars', 2),
  task('l1', 'loops', 3),
  task('g8', 'lists', 4, [8])
];

const lessons: MapLesson[] = [
  { slug: 'intro', taskSlugs: ['p1', 'v1'] },
  { slug: 'more', taskSlugs: ['p2', 'v2', 'p1'] },
  { slug: 'loops', taskSlugs: ['l1'] }
];

describe('topicMap', () => {
  it("lists the grade's topics in curriculum order, other grades left out", () => {
    expect(topicMap(lessons, tasks, new Set(), 7).map((node) => node.slug)).toEqual(['print', 'vars', 'loops']);
  });

  it('with nothing done, the first topic is current and the rest are ahead', () => {
    expect(topicMap(lessons, tasks, new Set(), 7).map((node) => node.state)).toEqual(['current', 'ahead', 'ahead']);
  });

  it('current is the first unfinished topic; a later topic already begun is started, not current', () => {
    const nodes = topicMap(lessons, tasks, new Set(['p1', 'p2', 'l1', 'v1']), 7);
    expect(nodes.map((node) => node.state)).toEqual(['done', 'current', 'done']);
    const partly = topicMap(lessons, [...tasks, task('l2', 'loops', 3)], new Set(['l1']), 7);
    expect(partly.map((node) => node.state)).toEqual(['current', 'ahead', 'started']);
  });

  it("leads to the topic's first unfinished task, in the lesson that first lists it", () => {
    const nodes = topicMap(lessons, tasks, new Set(['p1']), 7);
    expect(nodes[0].href).toBe('/practice/more/p2');
    expect(nodes[1].href).toBe('/practice/intro/v1');
  });

  it('a finished topic still leads somewhere: its first task', () => {
    const nodes = topicMap(lessons, tasks, new Set(['p1', 'p2']), 7);
    expect(nodes[0]).toMatchObject({ state: 'done', done: 2, total: 2, href: '/practice/intro/p1' });
  });
});
