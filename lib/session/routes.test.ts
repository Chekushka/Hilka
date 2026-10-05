import { describe, expect, it } from 'vitest';
import {
  cleanStudentRoutes,
  routeCounts,
  routeOf,
  routeTaskIdsFor,
  routeTasksFirst,
  suggestRouteTasks,
  type RouteCandidate
} from './routes';

const routeTasks = { support: ['s1', 's2'], extension: ['e1'] };

describe('routes', () => {
  it('gives a student the tasks of their route only', () => {
    const routes = { ann: 'support', bo: 'extension' } as const;
    expect(routeTaskIdsFor(routes, routeTasks, 'ann')).toEqual(['s1', 's2']);
    expect(routeTaskIdsFor(routes, routeTasks, 'bo')).toEqual(['e1']);
    expect(routeTaskIdsFor(routes, routeTasks, 'cy')).toEqual([]);
  });

  it('does not read inherited properties as a route', () => {
    expect(routeOf({}, 'constructor')).toBeNull();
    expect(routeOf({}, 'toString')).toBeNull();
  });

  it('puts support tasks first and extension tasks after', () => {
    expect(routeTasksFirst('support')).toBe(true);
    expect(routeTasksFirst('extension')).toBe(false);
    expect(routeTasksFirst(null)).toBe(false);
  });

  it('keeps only roster students, known routes and routes that have tasks', () => {
    const roster = new Set(['ann', 'bo', 'cy']);
    expect(
      cleanStudentRoutes({ ann: 'support', bo: 'extension', cy: 'gifted', zed: 'support' }, roster, routeTasks)
    ).toEqual({ ann: 'support', bo: 'extension' });
    expect(cleanStudentRoutes({ ann: 'extension' }, roster, { support: ['s1'], extension: [] })).toEqual({});
    expect(cleanStudentRoutes(['ann'], roster, routeTasks)).toEqual({});
    expect(cleanStudentRoutes(null, roster, routeTasks)).toEqual({});
  });

  it('counts students per route', () => {
    expect(routeCounts({ a: 'support', b: 'support', c: 'extension' })).toEqual({ support: 2, extension: 1 });
  });
});

describe('suggestRouteTasks', () => {
  const task = (id: string, topicSlug: string, difficulty: number, tags: RouteCandidate['tags'] = []): RouteCandidate => ({
    id,
    topicSlug,
    difficulty,
    tags
  });
  const bank = [
    task('main-loops', 'loops', 3),
    task('main-if', 'if', 2),
    task('loops-retype', 'loops', 1, ['retype', 'easy-start']),
    task('loops-easy', 'loops', 2, ['easy-start']),
    task('if-easy', 'if', 1),
    task('if-retype', 'if', 1, ['retype']),
    task('loops-hard', 'loops', 4),
    task('if-challenge', 'if', 5, ['challenge']),
    task('loops-challenge', 'loops', 4, ['challenge']),
    task('other-retype', 'turtle', 1, ['retype'])
  ];

  it('suggests typing-out tasks first, then easy starts, on the main tasks’ topics', () => {
    const taken = new Set(['main-loops', 'main-if']);
    expect(suggestRouteTasks('support', bank, ['main-loops', 'main-if'], taken, 4)).toEqual([
      'loops-retype',
      'if-retype',
      'loops-easy',
      'if-easy'
    ]);
  });

  it('suggests challenges first, then hard tasks', () => {
    const taken = new Set(['main-loops', 'main-if']);
    expect(suggestRouteTasks('extension', bank, ['main-loops', 'main-if'], taken, 5)).toEqual([
      'loops-challenge',
      'if-challenge',
      'loops-hard'
    ]);
  });

  it('never suggests a task already chosen, and stops at the limit', () => {
    const taken = new Set(['main-loops', 'main-if', 'loops-retype']);
    expect(suggestRouteTasks('support', bank, ['main-loops', 'main-if'], taken, 2)).toEqual(['if-retype', 'loops-easy']);
  });

  it('suggests nothing without main tasks', () => {
    expect(suggestRouteTasks('support', bank, [], new Set())).toEqual([]);
  });
});
