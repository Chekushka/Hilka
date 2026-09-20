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
  reference: Reference;
}

export function useTaskRunner(task: RunnableTask) {
  const runnerRef = useRef<PythonRunner | null>(null);
  // Not state: resolving it is how the worker's postMessage round trip
  // continues, not something a re-render should ever trigger on its own.
  const inputResolveRef = useRef<((value: string) => void) | null>(null);
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
      // Only a judged run needs the expr epilogue — a plain Run must not pay
      // for it or risk it changing behaviour the student didn't ask to check.
      const exprs = judge
        ? task.checks.filter((c): c is Check & { kind: 'expr' } => c.kind === 'expr').map((c) => c.python)
        : undefined;
      // Check grades against a fixed, pre-queued stdin (headless) so a
      // result is reproducible; a plain Run is the student exploring their
      // own program and answers input() live (interactive) — see
      // docs/TASKS.md, "Interactive input line in the output panel".
      const result = judge
        ? await runner.run(code, { mode: 'headless', exprs })
        : await runner.run(code, {
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
      setState((previous) => ({
        ...previous,
        busy: false,
        pendingInputPrompt: null,
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
