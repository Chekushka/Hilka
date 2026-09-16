import { describe, expect, it } from 'vitest';
import { checkTaskReference, type ReferenceCheckTask, type RunPython } from './reference-check';
import type { RunResult } from '@/lib/runner';

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    stdout: '',
    error: null,
    drawing: [],
    dots: [],
    timedOut: false,
    inputsConsumed: 0,
    elapsedMs: 0,
    vars: {},
    exprResults: {},
    ...overrides
  };
}

describe('checkTaskReference', () => {
  it('skips a task with no reference solution', async () => {
    const task: ReferenceCheckTask = { slug: 'quiz-1', type: 'quiz', checks: [] };
    const runPython: RunPython = async () => result();
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome).toEqual({ slug: 'quiz-1', skipped: true, passed: true, failures: [] });
  });

  it('passes a reference that satisfies every check, with no cases', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g7-square',
      type: 'code',
      checks: [{ kind: 'last_line_equals', value: '42' }],
      reference: { code: 'print(42)' }
    };
    const runPython: RunPython = async () => result({ stdout: '42\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
    expect(outcome.failures).toEqual([]);
  });

  it('treats the reference run as its own target for shape_equals', async () => {
    // shape_equals needs a target to compare against; for the reference's own
    // run that target IS the run, so this must not fail for lack of one.
    const task: ReferenceCheckTask = {
      slug: 'g7-square',
      type: 'code',
      checks: [{ kind: 'shape_equals', normalize: ['translate', 'rotate'] }],
      reference: { code: 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)' }
    };
    const drawing = [{ x1: 0, y1: 0, x2: 100, y2: 0, color: 'black', width: 1, line: null }];
    const runPython: RunPython = async () => result({ drawing });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
    expect(outcome.failures).toEqual([]);
  });

  it('reports which check the reference itself fails', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g7-broken-ref',
      type: 'code',
      checks: [{ kind: 'last_line_equals', value: '43', message: 'Очікували 43' }],
      reference: { code: 'print(42)' }
    };
    const runPython: RunPython = async () => result({ stdout: '42\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual([{ context: 'no cases', message: 'Очікували 43' }]);
  });

  it('reports a reference that raises instead of silently passing', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g8-bmi',
      type: 'code',
      checks: [{ kind: 'number_close', value: 22.86, tol: 0.05 }],
      reference: { code: 'w = float(input())\nprint(w / 0)' }
    };
    const runPython: RunPython = async () =>
      result({ error: { type: 'ZeroDivisionError', message: 'division by zero', line: 2, col: 0 } });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual([
      { context: 'no cases', message: 'reference solution raised ZeroDivisionError: division by zero' }
    ]);
  });

  it('runs once per case, with that case stdin and its own checks combined with task checks', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g8-bmi',
      type: 'code',
      checks: [],
      cases: [
        { stdin: ['70', '1.75'], label: 'звичайний випадок', checks: [{ kind: 'number_close', value: 22.86, tol: 0.05 }] },
        { stdin: ['50', '1.60'], label: 'менша вага', checks: [{ kind: 'number_close', value: 19.53, tol: 0.05 }] }
      ],
      reference: { code: 'w = float(input())\nh = float(input())\nprint(w / h ** 2)' }
    };
    const seen: string[][] = [];
    const runPython: RunPython = async (_code, options) => {
      seen.push(options.stdin ?? []);
      const [w, h] = (options.stdin ?? []).map(Number);
      return result({ stdout: String(w / h ** 2) });
    };
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
    expect(seen).toEqual([['70', '1.75'], ['50', '1.60']]);
  });

  it('flags a broken payload that passes every check on a fix task', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g8-fix-typo',
      type: 'fix',
      checks: [{ kind: 'last_line_equals', value: '42' }],
      reference: { code: 'print(42)' },
      payload: { broken: 'print(42)' }
    };
    const runPython: RunPython = async () => result({ stdout: '42\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual([
      { context: 'broken', message: 'payload.broken passes every check — a "broken" program must fail' }
    ]);
  });

  it('accepts a broken payload that genuinely fails', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g8-fix-typo',
      type: 'fix',
      checks: [{ kind: 'last_line_equals', value: '42' }],
      reference: { code: 'print(42)' },
      payload: { broken: 'print(41)' }
    };
    const runPython: RunPython = async (code) => result({ stdout: code.includes('41') ? '41\n' : '42\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
  });
});
