/**
 * Verifies that a task's reference solution actually passes its own checks —
 * CLAUDE.md rule 5's guarantee, checked mechanically instead of trusted.
 *
 * Pure: the caller supplies how to run Python, so this file has no dependency
 * on Skulpt or a Worker and never imports lib/runner/ itself (CLAUDE.md rule
 * 3) — only the RunOptions/RunResult shapes, which lib/checker/types.ts
 * already depends on for Segment. That keeps this unit-testable with a fake
 * runner and lets a Playwright script drive it with the real one.
 */
import { evaluateChecks } from './evaluate';
import type { Check, Evidence } from './types';
import type { RunOptions, RunResult } from '@/lib/runner';

export type RunPython = (code: string, options: RunOptions) => Promise<RunResult>;

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

function exprsOf(checks: Check[]): string[] {
  return checks
    .filter((check): check is Check & { kind: 'expr' } => check.kind === 'expr')
    .map((check) => check.python);
}

/** Which checks `result` fails, given `reference` as the target for shape_equals etc. */
function failedChecks(
  code: string,
  checks: Check[],
  result: RunResult,
  reference: Evidence['reference']
): string[] {
  const evidence: Evidence = {
    submission: { code },
    run: {
      stdout: result.stdout,
      drawing: result.drawing,
      error: result.error,
      timedOut: result.timedOut,
      vars: result.vars,
      exprResults: result.exprResults
    },
    reference
  };
  return evaluateChecks(checks, evidence)
    .results.filter((r) => !r.passed)
    .map((r) => r.message || `check "${r.check.kind}" failed`);
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
    if (result.error) {
      failures.push({ context, message: `reference solution raised ${result.error.type}: ${result.error.message}` });
      continue;
    }
    if (result.timedOut) {
      failures.push({ context, message: 'reference solution timed out' });
      continue;
    }
    // The reference IS the expected result: shape_equals compares this run
    // to itself here, trivially true. This still exercises every other check
    // kind against the reference's real output — shape_props, number_close,
    // uses, and so on.
    const selfReference: Evidence['reference'] = { stdout: result.stdout, drawing: result.drawing };
    if (referenceArtifacts === null) {
      referenceArtifacts = selfReference;
    }
    failedChecks(referenceCode, checks, result, selfReference).forEach((message) =>
      failures.push({ context, message })
    );
  }

  if (task.type === 'fix' && task.payload?.broken) {
    const broken = task.payload.broken;
    const result = await runPython(broken, { mode: 'headless', exprs: exprsOf(task.checks) });
    // A broken program that raises or times out has correctly failed; only a
    // clean run that satisfies every check is the bug TASK_SCHEMA.md warns
    // about.
    const stillPasses =
      !result.error && !result.timedOut && failedChecks(broken, task.checks, result, referenceArtifacts).length === 0;
    if (stillPasses) {
      failures.push({
        context: 'broken',
        message: 'payload.broken passes every check — a "broken" program must fail'
      });
    }
  }

  return { slug: task.slug, skipped: false, passed: failures.length === 0, failures };
}
