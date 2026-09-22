/**
 * Resolves a parameterized `code` task to one concrete variant
 * (docs/TASK_SCHEMA.md, "Parameterization") — substituting every `{name}`
 * placeholder in `payload.prompt`/`starter`, `cases[].stdin` and
 * `reference.code` with the values a seeded RNG picks. Pure: the caller
 * (GET /api/sessions/[code]/tasks/[taskId]) supplies the seed; this has no
 * knowledge of sessions, students, or the database.
 */
import { createRng, resolveParams, substituteParams } from '@/lib/seed';
import type { CodeTask } from './types';

/** `task` unchanged (params stripped either way) when there is nothing to resolve. */
export function resolveTaskParams(task: CodeTask, seed: number): CodeTask {
  if (!task.params) {
    return task;
  }
  const values = resolveParams(task.params, createRng(seed));
  return {
    ...task,
    payload: {
      ...task.payload,
      prompt: substituteParams(task.payload.prompt, values),
      starter: substituteParams(task.payload.starter, values)
    },
    cases: task.cases?.map((runCase) => ({
      ...runCase,
      stdin: runCase.stdin.map((line) => substituteParams(line, values))
    })),
    reference: { ...task.reference, code: substituteParams(task.reference.code, values) },
    params: undefined
  };
}
