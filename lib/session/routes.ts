/**
 * Routes: extra work for particular students in one session (docs/AI_CONTEXT.md,
 * "Routes"). The teacher puts a student on the support route — simple tasks
 * first, something they can finish — or the extension route — more after the
 * main tasks. Everyone else has no route and sees only the main tasks.
 *
 * Decided against the roster on purpose (CLAUDE.md rule 8): a route belongs to
 * the session, so it records what work was given today, never a judgement about
 * the student that follows them from lesson to lesson. The teacher may copy the
 * previous session's routes, which is a choice made again each time.
 *
 * Route tasks are never graded and never limited: they keep a student busy or
 * take them further, and like additional tasks they never lower a grade
 * (docs/AI_CONTEXT.md, "Grading"). Students never see a route's name — the room
 * shows one neutral heading for either.
 *
 * Pure.
 */
import { EXTENSION_TAGS, SUPPORT_TAGS, type TaskTag } from '@/lib/task/tags';

export const ROUTE_KEYS = ['support', 'extension'] as const;

export type RouteKey = (typeof ROUTE_KEYS)[number];

/** `{ [roster id]: route }`. A student who is not in it has no route. */
export type StudentRoutes = Record<string, RouteKey>;

export interface RouteTaskIds {
  support: readonly string[];
  extension: readonly string[];
}

export function isRouteKey(value: unknown): value is RouteKey {
  return value === 'support' || value === 'extension';
}

/** The student's route in this session, or null. */
export function routeOf(routes: StudentRoutes, studentId: string): RouteKey | null {
  const route = Object.prototype.hasOwnProperty.call(routes, studentId) ? routes[studentId] : undefined;
  return isRouteKey(route) ? route : null;
}

/** The extra tasks one student gets, in the teacher's order; empty without a route. */
export function routeTaskIdsFor(routes: StudentRoutes, routeTasks: RouteTaskIds, studentId: string): readonly string[] {
  const route = routeOf(routes, studentId);
  return route ? routeTasks[route] : [];
}

/** Support tasks come before the main ones — a first success; extension tasks after. */
export function routeTasksFirst(route: RouteKey | null): boolean {
  return route === 'support';
}

/**
 * The server's reading of a submitted route map: known routes, students on the
 * class roster only, and only routes that have tasks — a route with nothing in
 * it gives the student nothing, so it is not stored.
 */
export function cleanStudentRoutes(
  value: unknown,
  rosterIds: ReadonlySet<string>,
  routeTasks: RouteTaskIds
): StudentRoutes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const clean: StudentRoutes = {};
  for (const [studentId, route] of Object.entries(value)) {
    if (rosterIds.has(studentId) && isRouteKey(route) && routeTasks[route].length > 0) {
      clean[studentId] = route;
    }
  }
  return clean;
}

/** How many students are on each route. */
export function routeCounts(routes: StudentRoutes): Record<RouteKey, number> {
  const counts: Record<RouteKey, number> = { support: 0, extension: 0 };
  for (const route of Object.values(routes)) if (isRouteKey(route)) counts[route] += 1;
  return counts;
}

export interface RouteCandidate {
  id: string;
  topicSlug: string;
  difficulty: number;
  tags: readonly TaskTag[];
}

/** How well a task fits a route: lower is better; null when it does not fit at all. */
function fit(route: RouteKey, task: RouteCandidate): number | null {
  if (route === 'support') {
    if (task.tags.includes('retype')) return 0;
    if (task.tags.some((tag) => SUPPORT_TAGS.includes(tag))) return 1;
    return task.difficulty === 1 ? 2 : null;
  }
  if (task.tags.some((tag) => EXTENSION_TAGS.includes(tag))) return 0;
  return task.difficulty >= 4 ? 1 : null;
}

/**
 * Tasks to suggest for a route, on the topics of the session's main tasks:
 * for support, typing-out tasks first, then easy starts, then the easiest
 * tasks; for extension, challenges first, then the hard tasks. Nothing already
 * chosen anywhere in the session. Within a fit, the topics in the order the
 * main tasks name them, then the easier first.
 */
export function suggestRouteTasks(
  route: RouteKey,
  candidates: readonly RouteCandidate[],
  mainTaskIds: readonly string[],
  taken: ReadonlySet<string>,
  limit = 3
): string[] {
  const byId = new Map(candidates.map((task) => [task.id, task]));
  const topicOrder: string[] = [];
  for (const id of mainTaskIds) {
    const topic = byId.get(id)?.topicSlug;
    if (topic && !topicOrder.includes(topic)) topicOrder.push(topic);
  }
  return candidates
    .filter((task) => topicOrder.includes(task.topicSlug) && !taken.has(task.id))
    .flatMap((task) => {
      const score = fit(route, task);
      return score === null ? [] : [{ task, score }];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        topicOrder.indexOf(a.task.topicSlug) - topicOrder.indexOf(b.task.topicSlug) ||
        a.task.difficulty - b.task.difficulty
    )
    .slice(0, limit)
    .map(({ task }) => task.id);
}
