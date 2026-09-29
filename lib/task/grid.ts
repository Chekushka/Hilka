/**
 * The 8×8 grid world as task data (docs/TASK_SCHEMA.md, "Grid"). Pure: shape
 * checks for the authoring routes, and which world a runnable task's runs
 * take. The robot itself lives in lib/runner/modules/robot.ts.
 */
import type { GridCell, GridWorld } from '@/lib/runner';
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

/** The world a runnable task's runs take — only `code`/`fix` with `surface: 'grid'` have one. */
export function gridWorldOf(task: CodeTask | FixTask | FillTask): GridWorld | undefined {
  if (task.type === 'fill' || task.payload.surface !== 'grid') return undefined;
  return task.payload.grid;
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
