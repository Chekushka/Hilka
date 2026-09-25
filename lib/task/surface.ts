/**
 * Whether a runnable task's workspace shows the turtle canvas. A console task
 * that never draws gets no empty canvas next to its output; a turtle task
 * shows it from the start, before anything has run, exactly as it always did.
 * Pure — the task-type views pass in the task and the last run's drawing.
 */
import type { Check } from '@/lib/checker';
import type { Segment } from '@/lib/runner';
import type { CodeTask, FillTask, FixTask } from './types';

const SHAPE_KINDS: ReadonlySet<Check['kind']> = new Set(['shape_equals', 'shape_contains', 'shape_props']);

// Line-anchored so a mention of turtle in a string or comment does not count.
const TURTLE_IMPORT = /^[ \t]*(import[ \t]+turtle\b|from[ \t]+turtle[ \t]+import\b)/m;

/**
 * `code` and `fix` say so in `payload.surface`. `fill` has no surface field,
 * so it draws when its checks compare a shape or its template imports turtle.
 */
export function drawsTurtle(task: CodeTask | FixTask | FillTask): boolean {
  if (task.type !== 'fill') {
    return task.payload.surface === 'turtle';
  }
  return task.checks.some((check) => SHAPE_KINDS.has(check.kind)) || TURTLE_IMPORT.test(task.payload.template);
}

/** Declared turtle tasks always; anything else once a run actually drew. */
export function showsTurtleCanvas(task: CodeTask | FixTask | FillTask, drawing: readonly Segment[]): boolean {
  return drawsTurtle(task) || drawing.length > 0;
}
