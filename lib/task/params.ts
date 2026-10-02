/**
 * Resolves a parameterized task to one concrete variant
 * (docs/TASK_SCHEMA.md, "Parameterization") — substituting every `{name}`
 * placeholder with the values a seeded RNG picks:
 *
 * - `code`: `payload.prompt`/`starter`, `cases[].stdin`, `reference.code`,
 *   and a grid task's world (lib/seed/grid.ts);
 * - `fix`: `payload.prompt`/`broken`, `cases[].stdin`, `reference.code`;
 * - `fill`: `payload.prompt`/`template`, `reference.code`.
 *
 * Checks are not substituted: a parameterized console task checks with
 * `matches_reference`, whose expected output comes from running the resolved
 * reference on the same input, and a turtle one with `shape_equals`. Pure: the
 * caller (GET /api/sessions/[code]/tasks/[taskId], the teacher's re-check)
 * supplies the seed; this knows nothing of sessions, students or the database.
 */
import { createRng, resolveGridWorld, resolveParams, substituteParams, type ParamValues } from '@/lib/seed';
import { isValidGridWorld } from './grid';
import type { CodeTask, RunCase, Task } from './types';

function substituteCases(cases: RunCase[] | undefined, values: ParamValues): RunCase[] | undefined {
  return cases?.map((runCase) => ({ ...runCase, stdin: runCase.stdin.map((line) => substituteParams(line, values)) }));
}

/** Whether a task has parameters to resolve — and so must only ever be assigned to a session. */
export function isParameterized(task: Task): boolean {
  return (task.type === 'code' || task.type === 'fix' || task.type === 'fill') && Boolean(task.params);
}

/** `task` unchanged (params stripped either way) when there is nothing to resolve. */
export function resolveTaskParams<T extends Task>(task: T, seed: number): T {
  if (task.type !== 'code' && task.type !== 'fix' && task.type !== 'fill') return task;
  if (!task.params) return task;
  const values = resolveParams(task.params, createRng(seed));
  const reference = { ...task.reference, code: substituteParams(task.reference.code, values) };

  if (task.type === 'fix') {
    return {
      ...task,
      payload: {
        ...task.payload,
        prompt: substituteParams(task.payload.prompt, values),
        broken: substituteParams(task.payload.broken, values)
      },
      cases: substituteCases(task.cases, values),
      reference,
      params: undefined
    };
  }
  if (task.type === 'fill') {
    return {
      ...task,
      payload: {
        ...task.payload,
        prompt: substituteParams(task.payload.prompt, values),
        template: substituteParams(task.payload.template, values)
      },
      reference,
      params: undefined
    };
  }

  const code = task as CodeTask;
  const grid = code.payload.grid && resolveGridWorld(code.payload.grid, values);
  // Every combination is proven valid in CI (lib/task/grid-params.test.ts);
  // this only fires for a task that skipped that, and fails loudly rather
  // than handing a student a robot standing on a rock.
  if (grid && !isValidGridWorld(grid)) {
    throw new Error(`task ${code.slug}: parameters ${JSON.stringify(values)} give an invalid grid world`);
  }
  const resolved: CodeTask = {
    ...code,
    payload: {
      ...code.payload,
      prompt: substituteParams(code.payload.prompt, values),
      starter: substituteParams(code.payload.starter, values),
      ...(grid ? { grid } : {})
    },
    cases: substituteCases(code.cases, values),
    reference,
    params: undefined
  };
  return resolved as T;
}
