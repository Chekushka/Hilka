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
import { evaluateChecks, type CheckReport } from '@/lib/checker';
import { createRunner, type PythonRunner, type RunResult, type Segment } from '@/lib/runner';
import type { CodeTask } from './types';

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

export function useTaskRunner(task: CodeTask) {
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
      const result = await runner.run(code, { mode: 'headless' });
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
                  timedOut: result.timedOut
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
