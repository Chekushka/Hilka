/**
 * One Check of a program that runs: one headless run per case
 * (docs/TASK_SCHEMA.md, "Run cases"), or a single implicit case with no stdin
 * when the task has none. Every case's checks (the task's plus its own) are
 * evaluated, and a case beyond the first is a case that must ALSO pass. A case
 * that errors or times out stops the run there.
 *
 * Shared by the student's Check (lib/task/use-task-runner.ts) and the
 * teacher's re-check of stored answers (lib/task/recheck.ts), so the two can
 * never judge the same code differently. No React, no DOM; the runner is
 * passed in.
 */
import { evaluateChecks, type Check, type CheckResult } from '@/lib/checker';
import type { GridWorld, RunOptions, RunResult, Segment } from '@/lib/runner';
import type { RunCase } from './types';

export type RunPython = (code: string, options: RunOptions) => Promise<RunResult>;

export interface CheckableCode {
  checks: Check[];
  cases?: RunCase[];
  grid?: GridWorld;
  /**
   * The reference solution, run on the same case whenever a check compares
   * with its output (`matches_reference`). Without it such a check fails.
   */
  referenceCode?: string;
}

export interface CaseOutcome {
  /** The case's own label, null when the task has a single case. */
  label: string | null;
  /** 0-based; the caller names unlabelled cases. */
  index: number;
  results: CheckResult[];
  passed: boolean;
}

export interface CodeCheckOutcome {
  /** The first case's run — what the student sees when nothing errored. */
  shownResult: RunResult | null;
  /** Set when a case errored or timed out; no report then. */
  erroredResult: RunResult | null;
  cases: CaseOutcome[];
  casesPassed: number;
  casesTotal: number;
  passed: boolean;
}

export async function checkCode(
  task: CheckableCode,
  code: string,
  run: RunPython,
  target: Segment[]
): Promise<CodeCheckOutcome> {
  const cases: RunCase[] = task.cases && task.cases.length > 0 ? task.cases : [{ stdin: [] }];
  const multipleCases = cases.length > 1;
  let shownResult: RunResult | null = null;
  let erroredResult: RunResult | null = null;
  let casesPassed = 0;
  const outcomes: CaseOutcome[] = [];

  for (const [index, runCase] of cases.entries()) {
    const caseChecks = [...task.checks, ...(runCase.checks ?? [])];
    const exprs = caseChecks.filter((c): c is Check & { kind: 'expr' } => c.kind === 'expr').map((c) => c.python);
    const caseResult = await run(code, { mode: 'headless', stdin: runCase.stdin, exprs, grid: task.grid });
    shownResult ??= caseResult;
    if (caseResult.error || caseResult.timedOut) {
      erroredResult = caseResult;
      break;
    }
    // The expected output for this very input, computed by running the reference (CLAUDE.md rule 5).
    const needsReference = task.referenceCode !== undefined && caseChecks.some((c) => c.kind === 'matches_reference');
    const referenceStdout = needsReference
      ? (await run(task.referenceCode!, { mode: 'headless', stdin: runCase.stdin, grid: task.grid })).stdout
      : undefined;
    const report = evaluateChecks(caseChecks, {
      submission: { code },
      run: {
        stdout: caseResult.stdout,
        drawing: caseResult.drawing,
        error: caseResult.error,
        timedOut: caseResult.timedOut,
        vars: caseResult.vars,
        exprResults: caseResult.exprResults,
        grid: caseResult.grid
      },
      reference: { drawing: target, ...(referenceStdout !== undefined ? { stdout: referenceStdout } : {}) }
    });
    if (report.passed) casesPassed += 1;
    outcomes.push({
      label: multipleCases ? (runCase.label ?? null) : null,
      index,
      results: report.results,
      passed: report.passed
    });
  }

  return {
    shownResult,
    erroredResult,
    cases: outcomes,
    casesPassed,
    casesTotal: cases.length,
    passed: erroredResult === null && casesPassed === cases.length
  };
}
