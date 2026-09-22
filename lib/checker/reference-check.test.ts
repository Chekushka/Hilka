import { describe, expect, it } from 'vitest';
import {
  checkTaskReference,
  evaluateAgainstOwnRun,
  evaluatePredictionAgainstOwnRun,
  evaluatePredictionChoiceAgainstOwnRun,
  type ReferenceCheckTask,
  type RunPython
} from './reference-check';
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

  it('checks a predict task by submitting the reference run\'s own stdout as the prediction', async () => {
    // predict has no code of its own to submit — a perfect prediction IS
    // the fixed snippet's real stdout (lib/task/types.ts).
    const task: ReferenceCheckTask = {
      slug: 'g7-predict-arithmetic',
      type: 'predict',
      checks: [{ kind: 'text_equals', value: '14', normalize: 'trim' }],
      reference: { code: 'a = 2\nb = 3\nprint(a + b * 4)' }
    };
    const runPython: RunPython = async () => result({ stdout: '14\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
    expect(outcome.failures).toEqual([]);
  });

  it('reports a predict task whose checks do not match what the code actually prints', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g7-predict-arithmetic',
      type: 'predict',
      checks: [{ kind: 'text_equals', value: '20', normalize: 'trim', message: 'Очікували 20' }],
      reference: { code: 'a = 2\nb = 3\nprint(a + b * 4)' }
    };
    const runPython: RunPython = async () => result({ stdout: '14\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual([{ context: 'no cases', message: 'Очікували 20' }]);
  });

  it('checks a choice-mode predict task by comparing the chosen option to the real stdout', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g7-predict-choice',
      type: 'predict',
      checks: [{ kind: 'choice_equals', indices: [1] }],
      reference: { code: 'a = 2\nb = 3\nprint(a + b * 4)' },
      payload: { answerMode: 'choice', options: ['20', '14', '8'] }
    };
    const runPython: RunPython = async () => result({ stdout: '14\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(true);
    expect(outcome.failures).toEqual([]);
  });

  it('reports a choice-mode predict task whose chosen option does not match the real output', async () => {
    const task: ReferenceCheckTask = {
      slug: 'g7-predict-choice-wrong',
      type: 'predict',
      checks: [{ kind: 'choice_equals', indices: [0] }],
      reference: { code: 'a = 2\nb = 3\nprint(a + b * 4)' },
      payload: { answerMode: 'choice', options: ['20', '14', '8'] }
    };
    const runPython: RunPython = async () => result({ stdout: '14\n' });
    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual([
      { context: 'no cases', message: 'option "20" does not match the code\'s real output: "14"' }
    ]);
  });
});

describe('evaluateAgainstOwnRun', () => {
  // The publish gate: a route handler calls this with a run the teacher's
  // browser already produced, no live runPython involved.
  it('passes a clean run that satisfies every check', () => {
    const outcome = evaluateAgainstOwnRun('print(42)', [{ kind: 'last_line_equals', value: '42' }], result({ stdout: '42\n' }));
    expect(outcome).toEqual({ ranCleanly: true, passed: true, failures: [] });
  });

  it('reports a failing check without pretending the run itself failed', () => {
    const outcome = evaluateAgainstOwnRun(
      'print(41)',
      [{ kind: 'last_line_equals', value: '42', message: 'Очікували 42' }],
      result({ stdout: '41\n' })
    );
    expect(outcome).toEqual({ ranCleanly: true, passed: false, failures: ['Очікували 42'] });
  });

  it('marks a run that errored as not having run cleanly, with no check verdicts', () => {
    const outcome = evaluateAgainstOwnRun(
      'print(1 / 0)',
      [{ kind: 'last_line_equals', value: '1' }],
      result({ error: { type: 'ZeroDivisionError', message: 'division by zero', line: 1, col: 0 } })
    );
    expect(outcome).toEqual({ ranCleanly: false, passed: false, failures: [] });
  });
});

describe('evaluatePredictionAgainstOwnRun', () => {
  // predict's publish gate: the posted run is payload.code's own run, and a
  // perfect prediction is exactly its stdout.
  it('passes when the checks accept the run\'s own stdout as the prediction', () => {
    const outcome = evaluatePredictionAgainstOwnRun(
      '14\n',
      [{ kind: 'text_equals', value: '14', normalize: 'trim' }],
      result({ stdout: '14\n' })
    );
    expect(outcome).toEqual({ ranCleanly: true, passed: true, failures: [] });
  });

  it('reports a check whose hand-typed value does not match the real output', () => {
    const outcome = evaluatePredictionAgainstOwnRun(
      '14\n',
      [{ kind: 'text_equals', value: '20', normalize: 'trim', message: 'Очікували 20' }],
      result({ stdout: '14\n' })
    );
    expect(outcome).toEqual({ ranCleanly: true, passed: false, failures: ['Очікували 20'] });
  });
});

describe('evaluatePredictionChoiceAgainstOwnRun', () => {
  it('passes when the chosen option equals the run\'s own stdout', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(
      ['20', '14', '8'],
      [{ kind: 'choice_equals', indices: [1] }],
      result({ stdout: '14\n' })
    );
    expect(outcome).toEqual({ ranCleanly: true, passed: true, failures: [] });
  });

  it('fails when the chosen option does not equal the real output', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(
      ['20', '14', '8'],
      [{ kind: 'choice_equals', indices: [0] }],
      result({ stdout: '14\n' })
    );
    expect(outcome.ranCleanly).toBe(true);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual(['option "20" does not match the code\'s real output: "14"']);
  });

  it('fails structurally when there is no choice_equals check at all', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(['20', '14'], [], result({ stdout: '14\n' }));
    expect(outcome.ranCleanly).toBe(true);
    expect(outcome.passed).toBe(false);
  });

  it('fails structurally when choice_equals names more than one index', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(
      ['20', '14', '8'],
      [{ kind: 'choice_equals', indices: [0, 1] }],
      result({ stdout: '14\n' })
    );
    expect(outcome.ranCleanly).toBe(true);
    expect(outcome.passed).toBe(false);
  });

  it('fails when choice_equals references an option that does not exist', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(
      ['20', '14'],
      [{ kind: 'choice_equals', indices: [5] }],
      result({ stdout: '14\n' })
    );
    expect(outcome.ranCleanly).toBe(true);
    expect(outcome.passed).toBe(false);
    expect(outcome.failures).toEqual(['choice_equals references option 5, but there is no such option']);
  });

  it('marks a run that errored as not having run cleanly', () => {
    const outcome = evaluatePredictionChoiceAgainstOwnRun(
      ['20', '14'],
      [{ kind: 'choice_equals', indices: [1] }],
      result({ error: { type: 'ZeroDivisionError', message: 'division by zero', line: 1, col: 0 } })
    );
    expect(outcome).toEqual({ ranCleanly: false, passed: false, failures: [] });
  });
});
