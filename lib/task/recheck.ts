/**
 * Re-checks a stored answer the way the student's Check judged it
 * (docs/HOMEWORK.md, section 5, threat 5). Grading happens in the student's
 * browser, so a student with devtools can post `passed: true` for anything;
 * but every attempt stores what was submitted, and re-running that through
 * the same checker — in the teacher's browser, since there is no server-side
 * Python — shows whether the stored answer really passes. Forging a pass then
 * means forging an answer that passes, which is solving the task.
 *
 * Programs (`code`, `fix`, `fill`) run through `checkCode`, exactly as the
 * room's Check does, against the reference's own drawing; answers that never
 * run (`quiz`, `predict`, `parsons`) are evaluated directly. The task must be
 * the one the student saw — for a parameterized task, their own variant.
 */
import { evaluateChecks, type Submission } from '@/lib/checker';
import { checkCode, type RunPython } from './check-code';
import { gridWorldOf } from './grid';
import type { Task } from './types';

/** One passed attempt to re-check, as `GET /api/dashboard/sessions/[id]/recheck` sends it. */
export interface RecheckItem {
  attemptId: string;
  studentName: string;
  taskTitle: string;
  createdAt: string;
  submittedAnswer: Record<string, unknown> | null;
  /** The task as this student saw it; null when the attempt was on another version than the one published now. */
  task: Task | null;
}

/** `passes`/`fails` as the checker judges it now; `unreadable` when the stored answer has no usable shape. */
export type RecheckVerdict = 'passes' | 'fails' | 'unreadable';

function isSubmission(value: unknown): value is Submission {
  return typeof value === 'object' && value !== null;
}

export async function recheckAnswer(task: Task, submittedAnswer: unknown, run: RunPython): Promise<RecheckVerdict> {
  if (!isSubmission(submittedAnswer)) return 'unreadable';

  if (task.type === 'code' || task.type === 'fix' || task.type === 'fill') {
    const code = submittedAnswer.code;
    if (typeof code !== 'string') return 'unreadable';
    const grid = gridWorldOf(task);
    const cases = task.type === 'fill' ? undefined : task.cases;
    // The target drawing comes from running the reference, as when the room warms up.
    const reference = await run(task.reference.code, { mode: 'headless', stdin: cases?.[0]?.stdin ?? [], grid });
    const outcome = await checkCode(
      { checks: task.checks, cases, grid, referenceCode: task.reference.code },
      code,
      run,
      reference.drawing
    );
    return outcome.passed ? 'passes' : 'fails';
  }

  return evaluateChecks(task.checks, { submission: submittedAnswer }).passed ? 'passes' : 'fails';
}
