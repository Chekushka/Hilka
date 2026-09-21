'use client';

/**
 * Wires one task to the runner and the checker.
 *
 * Expected results are computed by executing the author's reference solution,
 * never stored by hand — so the reference runs once when the engine warms up
 * and its segment log becomes the target the student's drawing is compared and
 * overlaid against.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateChecks, type Check, type CheckReport, type CheckResult } from '@/lib/checker';
import { t } from '@/lib/i18n';
import { createRunner, type PythonRunner, type RunResult, type Segment } from '@/lib/runner';
import type { Reference, RunCase } from './types';

export type EngineState = 'loading' | 'ready' | 'failed';

export interface TaskRunnerState {
  engine: EngineState;
  busy: boolean;
  /** The last run, whether it was a plain run or a check. */
  result: RunResult | null;
  /** Set only after Check, so a plain run never judges the student. */
  report: CheckReport | null;
  target: Segment[];
  /**
   * Set while a plain Run is inside `input()`, waiting on the student — the
   * text is what the student's own code passed to `input(...)`, shown next
   * to the answer field rather than printed into stdout (the engine hands it
   * over separately, never as part of the program's own output). `null`
   * outside of a wait; `submitInput` is how the workspace answers it.
   */
  pendingInputPrompt: string | null;
}

const EMPTY_RESULT: RunResult = {
  stdout: '',
  error: null,
  drawing: [],
  dots: [],
  timedOut: false,
  inputsConsumed: 0,
  elapsedMs: 0,
  vars: {},
  exprResults: {}
};

/**
 * Everything this hook needs from a task — `code` and `fix` both satisfy it
 * (the student edits different starting code, `payload.starter` vs
 * `payload.broken`, but run and Check work identically once there's a
 * `reference` to warm up against and `checks` to judge with).
 */
export interface RunnableTask {
  checks: Check[];
  /** Input-driven only. Absent (or empty) means a single implicit case with no stdin. */
  cases?: RunCase[];
  reference: Reference;
}

export function useTaskRunner(task: RunnableTask) {
  const runnerRef = useRef<PythonRunner | null>(null);
  // Not state: resolving it is how the worker's postMessage round trip
  // continues, not something a re-render should ever trigger on its own.
  const inputResolveRef = useRef<((value: string) => void) | null>(null);
  // Check's case loop needs the warmed-up target mid-run, before the final
  // setState — a ref survives that gap without going stale between renders
  // the way a value closed over by the memoized `execute` below would.
  const targetRef = useRef<Segment[]>([]);
  const [state, setState] = useState<TaskRunnerState>({
    engine: 'loading',
    busy: false,
    result: null,
    report: null,
    target: [],
    pendingInputPrompt: null
  });

  useEffect(() => {
    const runner = createRunner();
    runnerRef.current = runner;
    let cancelled = false;

    runner
      .warmUp()
      // The first case's stdin, if there is one — a console-surface
      // reference that calls input() needs it to run at all. Turtle
      // references never have cases, so this is `[]` for them, unchanged.
      .then(() => runner.run(task.reference.code, { mode: 'headless', stdin: task.cases?.[0]?.stdin ?? [] }))
      .then((reference) => {
        if (cancelled) return;
        targetRef.current = reference.drawing;
        setState((previous) => ({
          ...previous,
          engine: 'ready',
          target: reference.drawing
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setState((previous) => ({ ...previous, engine: 'failed' }));
        }
      });

    return () => {
      cancelled = true;
      runner.dispose();
      runnerRef.current = null;
    };
  }, [task.reference.code, task.cases]);

  /**
   * Check: one headless run per case (docs/TASK_SCHEMA.md, "Run cases"), a
   * single implicit no-stdin case when the task has none — that fallback is
   * exactly the old single-run behaviour, so a task with no `cases` is
   * unaffected. Every case's checks (task-level plus its own) are evaluated
   * and merged into one report; a case beyond the first is a case that must
   * ALSO pass for the task to pass. A case that errors or times out stops
   * the run there — that becomes the shown result, same as a plain run's own
   * error/timeout — rather than piling one failure on top of another.
   */
  const runChecks = useCallback(
    async (code: string) => {
      const runner = runnerRef.current;
      if (!runner) return;
      const cases: RunCase[] = task.cases && task.cases.length > 0 ? task.cases : [{ stdin: [] }];
      const multipleCases = cases.length > 1;

      let shownResult: RunResult | null = null;
      let erroredResult: RunResult | null = null;
      let allPassed = true;
      const results: CheckResult[] = [];

      for (const [i, runCase] of cases.entries()) {
        const caseChecks = [...task.checks, ...(runCase.checks ?? [])];
        const exprs = caseChecks.filter((c): c is Check & { kind: 'expr' } => c.kind === 'expr').map((c) => c.python);
        const caseResult = await runner.run(code, { mode: 'headless', stdin: runCase.stdin, exprs });
        shownResult ??= caseResult;
        if (caseResult.error || caseResult.timedOut) {
          erroredResult = caseResult;
          break;
        }
        const caseReport = evaluateChecks(caseChecks, {
          submission: { code },
          run: {
            stdout: caseResult.stdout,
            drawing: caseResult.drawing,
            error: caseResult.error,
            timedOut: caseResult.timedOut,
            vars: caseResult.vars,
            exprResults: caseResult.exprResults
          },
          reference: { drawing: targetRef.current }
        });
        if (!caseReport.passed) allPassed = false;
        const label = multipleCases ? (runCase.label ?? t('workspace.caseLabel', { n: i + 1 })) : null;
        for (const result of caseReport.results) {
          results.push(label ? { ...result, message: `${label}: ${result.message}` } : result);
        }
      }

      setState((previous) => ({
        ...previous,
        busy: false,
        pendingInputPrompt: null,
        result: erroredResult ?? shownResult ?? EMPTY_RESULT,
        report: erroredResult ? null : { passed: allPassed, results }
      }));
    },
    [task.checks, task.cases]
  );

  /**
   * Plain Run: interactive, so the student answers their own program's
   * input() calls live and sees stdout as it streams in — see
   * docs/TASKS.md, "Interactive input line in the output panel". Never
   * judged, and never paged through `cases` — the student is exploring
   * their own program, not being graded against the author's scenarios.
   */
  const runInteractive = useCallback(async (code: string) => {
    const runner = runnerRef.current;
    if (!runner) return;
    const result = await runner.run(code, {
      mode: 'interactive',
      onStdout: (chunk) =>
        setState((previous) => ({
          ...previous,
          result: { ...(previous.result ?? EMPTY_RESULT), stdout: (previous.result ?? EMPTY_RESULT).stdout + chunk }
        })),
      onInputRequest: (prompt) =>
        new Promise<string>((resolve) => {
          inputResolveRef.current = resolve;
          setState((previous) => ({ ...previous, pendingInputPrompt: prompt }));
        })
    });
    inputResolveRef.current = null;
    setState((previous) => ({ ...previous, busy: false, pendingInputPrompt: null, result, report: null }));
  }, []);

  const execute = useCallback(
    async (code: string, judge: boolean) => {
      if (!runnerRef.current) return;
      inputResolveRef.current = null;
      setState((previous) => ({
        ...previous,
        busy: true,
        report: null,
        pendingInputPrompt: null,
        // A plain Run streams into this from here; Check keeps the previous
        // result on screen until its own single result replaces it below.
        result: judge ? previous.result : EMPTY_RESULT
      }));
      if (judge) {
        await runChecks(code);
      } else {
        await runInteractive(code);
      }
    },
    [runChecks, runInteractive]
  );

  const run = useCallback((code: string) => execute(code, false), [execute]);
  const check = useCallback((code: string) => execute(code, true), [execute]);

  /** Answers the pending `input()` call. A no-op once nothing is waiting. */
  const submitInput = useCallback((value: string) => {
    const resolve = inputResolveRef.current;
    if (!resolve) return;
    inputResolveRef.current = null;
    setState((previous) => ({ ...previous, pendingInputPrompt: null }));
    resolve(value);
  }, []);

  return { ...state, run, check, submitInput };
}
