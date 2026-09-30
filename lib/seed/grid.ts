/**
 * A parameterized grid world (docs/TASK_SCHEMA.md, "Grid" and
 * "Parameterization"): the world a `code` task stores may name a parameter
 * in place of any coordinate or the start direction — `{"x": "{gx}", "y": 4}`
 * — and each student's variant places the robot, the battery or a rock
 * where their seed says. Pure; the same substitution as `substituteParams`,
 * then read back as numbers. Whether the result is a world the robot can
 * stand in is lib/task/grid.ts's `isValidGridWorld`, not this file's.
 */
import type { GridCell, GridDir, GridWorld } from '@/lib/runner';
import { substituteParams, type ParamValues } from './params';

/** A number, or a `{name}` placeholder for one. */
export type GridCoordSpec = number | string;

export interface GridCellSpec {
  x: GridCoordSpec;
  y: GridCoordSpec;
}

export interface GridWorldSpec {
  start: GridCellSpec & { dir: GridDir | string };
  goal: GridCellSpec;
  rocks: GridCellSpec[];
}

const PLACEHOLDER = /^\{\w+\}$/;

/** A placeholder string exactly, not text that merely contains one. */
export function isPlaceholder(value: unknown): value is string {
  return typeof value === 'string' && PLACEHOLDER.test(value);
}

/** Whether any coordinate or the direction still waits for a parameter. */
export function worldHasPlaceholders(spec: GridWorldSpec): boolean {
  const cells = [spec.start, spec.goal, ...spec.rocks];
  return isPlaceholder(spec.start.dir) || cells.some((cell) => isPlaceholder(cell.x) || isPlaceholder(cell.y));
}

function coord(value: GridCoordSpec, values: ParamValues): number {
  // An unresolved or non-numeric value becomes NaN, which no validity check accepts.
  return typeof value === 'number' ? value : Number(substituteParams(value, values));
}

function cell(spec: GridCellSpec, values: ParamValues): GridCell {
  return { x: coord(spec.x, values), y: coord(spec.y, values) };
}

/** The concrete world one variant plays in. Validate the result before trusting it. */
export function resolveGridWorld(spec: GridWorldSpec, values: ParamValues): GridWorld {
  return {
    start: { ...cell(spec.start, values), dir: substituteParams(String(spec.start.dir), values) as GridDir },
    goal: cell(spec.goal, values),
    rocks: spec.rocks.map((rock) => cell(rock, values))
  };
}
