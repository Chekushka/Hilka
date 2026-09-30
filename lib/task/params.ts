/**
 * Resolves a parameterized `code` task to one concrete variant
 * (docs/TASK_SCHEMA.md, "Parameterization") — substituting every `{name}`
 * placeholder in `payload.prompt`/`starter`, `cases[].stdin` and
 * `reference.code` with the values a seeded RNG picks, and in a grid task's
 * world (lib/seed/grid.ts). Pure: the caller
 * (GET /api/sessions/[code]/tasks/[taskId]) supplies the seed; this has no
 * knowledge of sessions, students, or the database.
 */
import { createRng, resolveGridWorld, resolveParams, substituteParams } from '@/lib/seed';
import { isValidGridWorld } from './grid';
import type { CodeTask } from './types';

/** `task` unchanged (params stripped either way) when there is nothing to resolve. */
export function resolveTaskParams(task: CodeTask, seed: number): CodeTask {
  if (!task.params) {
    return task;
  }
  const values = resolveParams(task.params, createRng(seed));
  const grid = task.payload.grid && resolveGridWorld(task.payload.grid, values);
  // Every combination is proven valid in CI (lib/task/grid-params.test.ts);
  // this only fires for a task that skipped that, and fails loudly rather
  // than handing a student a robot standing on a rock.
  if (grid && !isValidGridWorld(grid)) {
    throw new Error(`task ${task.slug}: parameters ${JSON.stringify(values)} give an invalid grid world`);
  }
  return {
    ...task,
    payload: {
      ...task.payload,
      prompt: substituteParams(task.payload.prompt, values),
      starter: substituteParams(task.payload.starter, values),
      ...(grid ? { grid } : {})
    },
    cases: task.cases?.map((runCase) => ({
      ...runCase,
      stdin: runCase.stdin.map((line) => substituteParams(line, values))
    })),
    reference: { ...task.reference, code: substituteParams(task.reference.code, values) },
    params: undefined
  };
}
