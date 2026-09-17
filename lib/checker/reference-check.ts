/**
 * Verifies that a reference solution actually passes its own checks —
 * CLAUDE.md rule 5's guarantee, checked mechanically instead of trusted.
 *
 * Pure: nothing here executes Python or imports lib/runner/ itself (CLAUDE.md
 * rule 3), only the RunResult shape, which lib/checker/types.ts already
 * depends on for Segment. `evaluateAgainstOwnRun` is the primitive both the
 * publish gate (a real run posted from the teacher's browser, evaluated
 * server-side in a route handler) and `checkTaskReference` (a live run driven
 * by Playwright, for CI) build on.
 */
import { evaluateChecks } from './evaluate';
import type { Check, Evidence, Submission } from './types';
import type { RunOptions, RunResult } from '@/lib/runner';

export type RunPython = (code: string, options: RunOptions) => Promise<RunResult>;

/** What a caller already has after running some code — no worker, no Skulpt. */
export type RunOutcome = Pick<RunResult, 'stdout' | 'drawing' | 'error' | 'timedOut' | 'vars' | 'exprResults'>;

export interface CheckRunOutcome {
  /** False when `run` itself errored or timed out — no check was even judged. */
  ranCleanly: boolean;
  passed: boolean;
  /** Check failure messages. Empty when `!ranCleanly`. */
  failures: string[];
}

function exprsOf(checks: Check[]): string[] {
  return checks
    .filter((check): check is Check & { kind: 'expr' } => check.kind === 'expr')
    .map((check) => check.python);
}

/** Which of `checks` `run` fails, given `reference` as the target for shape_equals etc. */
export function evaluateRun(
  submission: Submission,
  checks: Check[],
  run: RunOutcome,
  reference: Evidence['reference']
): CheckRunOutcome {
  if (run.error || run.timedOut) {
    return { ranCleanly: false, passed: false, failures: [] };
  }
  const evidence: Evidence = {
    submission,
    run: {
      stdout: run.stdout,
      drawing: run.drawing,
      error: run.error,
      timedOut: run.timedOut,
      vars: run.vars,
      exprResults: run.exprResults
    },
    reference
  };
  const failures = evaluateChecks(checks, evidence)
    .results.filter((r) => !r.passed)
    .map((r) => r.message || `check "${r.check.kind}" failed`);
  return { ranCleanly: true, passed: failures.length === 0, failures };
}

/**
 * A reference solution's own run defines "expected": shape_equals compares
 * the run to itself here, trivially true. This still exercises every other
 * check kind — shape_props, number_close, uses — against the reference's
 * real output. This is the publish gate: a route handler calls it with a run
 * the teacher's browser already produced (no server-side Python — see
 * AI_CONTEXT.md, "Python Runner").
 */
export function evaluateAgainstOwnRun(code: string, checks: Check[], run: RunOutcome): CheckRunOutcome {
  return evaluateRun({ code }, checks, run, { stdout: run.stdout, drawing: run.drawing });
}

/**
 * `predict`'s equivalent of `evaluateAgainstOwnRun`: the fixed snippet in
 * `payload.code` IS the reference, and a perfect prediction is exactly its
 * real stdout — so checking that stdout as a `text` submission against the
 * task's own checks confirms whatever value the author typed into e.g.
 * `text_equals` actually matches what the code prints, instead of trusting
 * it by hand (CLAUDE.md rule 5).
 */
export function evaluatePredictionAgainstOwnRun(text: string, checks: Check[], run: RunOutcome): CheckRunOutcome {
  return evaluateRun({ text }, checks, run, { stdout: run.stdout, drawing: run.drawing });
}

/** The subset of a task's shape this needs — mirrors validate.ts's TaskShape. */
export interface ReferenceCheckTask {
  slug: string;
  type: string;
  checks: Check[];
  cases?: { stdin: string[]; checks?: Check[]; label?: string }[] | null;
  reference?: { code: string } | null;
  payload?: { broken?: string };
}

export interface ReferenceCheckFailure {
  /** The case label, or 'no cases' / 'broken' for the run it came from. */
  context: string;
  message: string;
}

export interface ReferenceCheckOutcome {
  slug: string;
  /** True when the task has no reference solution to run — nothing to verify. */
  skipped: boolean;
  passed: boolean;
  failures: ReferenceCheckFailure[];
}

/**
 * Runs `task.reference.code` — once per case, or once with no stdin when
 * there are none — and confirms every check passes. For a `fix` task with a
 * `broken` payload, also confirms `broken` does NOT pass, per TASK_SCHEMA.md:
 * a "broken" program that passes is a bug in the task, not a strict solution.
 */
export async function checkTaskReference(
  task: ReferenceCheckTask,
  runPython: RunPython
): Promise<ReferenceCheckOutcome> {
  const referenceCode = task.reference?.code;
  if (!referenceCode) {
    return { slug: task.slug, skipped: true, passed: true, failures: [] };
  }

  const failures: ReferenceCheckFailure[] = [];
  const hasCases = (task.cases?.length ?? 0) > 0;
  const cases = hasCases ? task.cases! : [{ stdin: [], checks: [] as Check[] }];

  // The target for a broken payload's shape_equals etc. below: the correct
  // reference's own drawing/stdout from its first case.
  let referenceArtifacts: Evidence['reference'] = null;

  for (const [i, runCase] of cases.entries()) {
    const context = runCase.label ?? (hasCases ? `case ${i + 1}` : 'no cases');
    const checks = [...task.checks, ...(runCase.checks ?? [])];
    const result = await runPython(referenceCode, {
      mode: 'headless',
      stdin: runCase.stdin,
      exprs: exprsOf(checks)
    });
    // `predict` has no code of its own to submit — a perfect prediction IS
    // the reference's real stdout (lib/task/types.ts).
    const outcome =
      task.type === 'predict'
        ? evaluatePredictionAgainstOwnRun(result.stdout, checks, result)
        : evaluateAgainstOwnRun(referenceCode, checks, result);
    if (!outcome.ranCleanly) {
      failures.push({
        context,
        message: result.error
          ? `reference solution raised ${result.error.type}: ${result.error.message}`
          : 'reference solution timed out'
      });
      continue;
    }
    if (referenceArtifacts === null) {
      referenceArtifacts = { stdout: result.stdout, drawing: result.drawing };
    }
    outcome.failures.forEach((message) => failures.push({ context, message }));
  }

  if (task.type === 'fix' && task.payload?.broken) {
    const broken = task.payload.broken;
    const result = await runPython(broken, { mode: 'headless', exprs: exprsOf(task.checks) });
    // A broken program that raises or times out has correctly failed; only a
    // clean run that satisfies every check is the bug TASK_SCHEMA.md warns
    // about.
    const outcome = evaluateRun({ code: broken }, task.checks, result, referenceArtifacts);
    if (outcome.passed) {
      failures.push({
        context: 'broken',
        message: 'payload.broken passes every check — a "broken" program must fail'
      });
    }
  }

  return { slug: task.slug, skipped: false, passed: failures.length === 0, failures };
}
