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
import { evaluateChecks, type Check, type CheckReport } from '@/lib/checker';
import { createRunner, type PythonRunner, type RunResult, type Segment } from '@/lib/runner';
import type { Reference } from './types';

export type EngineState = 'loading' | 'ready' | 'failed';

export interface TaskRunnerState {
  engine: EngineState;
  busy: boolean;
  /** The last run, whether it was a plain run or a check. */
  result: RunResult | null;
  /** Set only after Check, so a plain run never judges the student. */
  report: CheckReport | null;
  target: Segment[];
}

/**
 * Everything this hook needs from a task — `code` and `fix` both satisfy it
 * (the student edits different starting code, `payload.starter` vs
 * `payload.broken`, but run and Check work identically once there's a
 * `reference` to warm up against and `checks` to judge with).
 */
export interface RunnableTask {
  checks: Check[];
  reference: Reference;
}

export function useTaskRunner(task: RunnableTask) {
  const runnerRef = useRef<PythonRunner | null>(null);
  const [state, setState] = useState<TaskRunnerState>({
    engine: 'loading',
    busy: false,
    result: null,
    report: null,
    target: []
  });

  useEffect(() => {
    const runner = createRunner();
    runnerRef.current = runner;
    let cancelled = false;

    runner
      .warmUp()
      .then(() => runner.run(task.reference.code, { mode: 'headless' }))
      .then((reference) => {
        if (cancelled) return;
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
  }, [task.reference.code]);

  const execute = useCallback(
    async (code: string, judge: boolean) => {
      const runner = runnerRef.current;
      if (!runner) return;
      setState((previous) => ({ ...previous, busy: true, report: null }));
      // Only a judged run needs the expr epilogue — a plain Run must not pay
      // for it or risk it changing behaviour the student didn't ask to check.
      const exprs = judge
        ? task.checks.filter((c): c is Check & { kind: 'expr' } => c.kind === 'expr').map((c) => c.python)
        : undefined;
      const result = await runner.run(code, { mode: 'headless', exprs });
      setState((previous) => ({
        ...previous,
        busy: false,
        result,
        report:
          judge && !result.error && !result.timedOut
            ? evaluateChecks(task.checks, {
                submission: { code },
                run: {
                  stdout: result.stdout,
                  drawing: result.drawing,
                  error: result.error,
                  timedOut: result.timedOut,
                  vars: result.vars,
                  exprResults: result.exprResults
                },
                reference: { drawing: previous.target }
              })
            : null
      }));
    },
    [task.checks]
  );

  const run = useCallback((code: string) => execute(code, false), [execute]);
  const check = useCallback((code: string) => execute(code, true), [execute]);

  return { ...state, run, check };
}
