import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { enumerateParamCombinations, resolveGridWorld, worldHasPlaceholders, type GridWorldSpec, type ParamSpec } from '@/lib/seed';
import { isValidGridWorld } from './grid';
import { isTaskPayload } from './payload-guards';

/**
 * Every combination of a parameterized grid task in content/ is a world the
 * robot can stand in (docs/TASK_SCHEMA.md, "Grid"). No Python here —
 * `npm run verify:references` proves the reference solves each one; this
 * proves each one is a world at all, so `resolveTaskParams` never throws
 * for a student.
 */

const dir = path.join(process.cwd(), 'content', 'seed-tasks');
const tasks = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as {
    slug: string;
    payload: { grid?: GridWorldSpec };
    params?: ParamSpec;
  });

const parameterized = tasks.filter((task) => task.payload.grid && worldHasPlaceholders(task.payload.grid));

describe('parameterized grid worlds in content', () => {
  it('exist, so the rule below is not vacuous', () => {
    expect(parameterized.length).toBeGreaterThan(0);
  });

  it.each(parameterized.map((task) => [task.slug, task] as const))('%s: every combination is a valid world', (_, task) => {
    expect(isTaskPayload(task.payload)).toBe(true);
    expect(task.params).toBeDefined();
    for (const combo of enumerateParamCombinations(task.params!)) {
      const world = resolveGridWorld(task.payload.grid!, combo);
      expect(isValidGridWorld(world), `${JSON.stringify(combo)} → ${JSON.stringify(world)}`).toBe(true);
    }
  });
});
