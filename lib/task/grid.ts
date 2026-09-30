/**
 * The 8×8 grid world as task data (docs/TASK_SCHEMA.md, "Grid"). Pure: shape
 * checks for the authoring routes, and which world a runnable task's runs
 * take. The robot itself lives in lib/runner/modules/robot.ts.
 */
import type { GridCell, GridWorld } from '@/lib/runner';
import { isPlaceholder, type GridWorldSpec } from '@/lib/seed';
import type { CodeTask, FillTask, FixTask } from './types';

export const GRID_SIZE = 8;

const DIRS = new Set(['N', 'E', 'S', 'W']);

function isCell(value: unknown): value is GridCell {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return (
    typeof x === 'number' && typeof y === 'number' &&
    Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE
  );
}

export function sameCell(a: GridCell, b: GridCell): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * On the field, a direction to face, the goal somewhere else than the start,
 * and no rock on either — a world the reference solution can actually solve
 * is then the publish gate's job (it runs it).
 */
export function isValidGridWorld(value: unknown): value is GridWorld {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  if (!isCell(w.start) || !DIRS.has((w.start as unknown as { dir: unknown }).dir as string)) return false;
  if (!isCell(w.goal) || sameCell(w.start, w.goal)) return false;
  if (!Array.isArray(w.rocks) || !w.rocks.every(isCell)) return false;
  const start = w.start;
  const goal = w.goal;
  return !w.rocks.some((rock) => sameCell(rock, start) || sameCell(rock, goal));
}

/** A coordinate as stored: on the field, or a placeholder a parameter fills in. */
function isCoordSpec(value: unknown): boolean {
  return isPlaceholder(value) || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GRID_SIZE);
}

function isCellSpec(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return isCoordSpec(x) && isCoordSpec(y);
}

/**
 * A world as a `code` task stores it: concrete and valid, or with
 * placeholders in it — then only the shape is checked here, since whether
 * each variant is a valid world depends on the parameters; every
 * combination is proven valid in CI (lib/task/grid-params.test.ts) and
 * resolving one checks it again (`resolveTaskParams`).
 */
export function isGridWorldSpec(value: unknown): value is GridWorldSpec {
  if (isValidGridWorld(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  const start = w.start as Record<string, unknown> | undefined;
  return (
    isCellSpec(w.start) &&
    (DIRS.has(start?.dir as string) || isPlaceholder(start?.dir)) &&
    isCellSpec(w.goal) &&
    Array.isArray(w.rocks) &&
    w.rocks.every(isCellSpec)
  );
}

/**
 * The world a runnable task's runs take: `code`/`fix` with `surface: 'grid'`,
 * or a `fill` with a world. A world still holding placeholders is no world
 * to run in — only a resolved session variant reaches a student.
 */
export function gridWorldOf(task: CodeTask | FixTask | FillTask): GridWorld | undefined {
  if (task.type !== 'fill' && task.payload.surface !== 'grid') return undefined;
  const world: unknown = task.payload.grid;
  return isValidGridWorld(world) ? world : undefined;
}

/** A new grid task starts with something to solve: left edge to right edge. */
export const DEFAULT_GRID_WORLD: GridWorld = { start: { x: 0, y: 4, dir: 'E' }, goal: { x: 7, y: 4 }, rocks: [] };

export type GridTool = 'start' | 'goal' | 'rock';

/**
 * The authoring field's click: the robot and the battery move there (clearing
 * a rock), a rock toggles. Never produces an invalid world — a click that
 * would stack the robot and the battery, or bury either, changes nothing.
 */
export function placeOnGrid(world: GridWorld, tool: GridTool, cell: GridCell): GridWorld {
  const withoutRock = world.rocks.filter((rock) => !sameCell(rock, cell));
  if (tool === 'start') {
    if (sameCell(cell, world.goal)) return world;
    return { ...world, start: { ...cell, dir: world.start.dir }, rocks: withoutRock };
  }
  if (tool === 'goal') {
    if (sameCell(cell, world.start)) return world;
    return { ...world, goal: cell, rocks: withoutRock };
  }
  if (sameCell(cell, world.start) || sameCell(cell, world.goal)) return world;
  return { ...world, rocks: withoutRock.length < world.rocks.length ? withoutRock : [...world.rocks, cell] };
}
